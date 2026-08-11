const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL || "https://ng-bot-c0im.onrender.com";

const REPORT_HTML = path.join(__dirname, "report.html");
const REPORT_JPG = path.join(__dirname, "report.jpg");
const PREVIEW_JPG = path.join(__dirname, "report-preview.jpg");

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

async function makeReportImages() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setViewport({
    width: 520,
    height: 900,
    deviceScaleFactor: 2,
  });

  await page.goto("file://" + REPORT_HTML, {
    waitUntil: "networkidle0",
  });

  await new Promise(resolve => setTimeout(resolve, 300));

  const png = await page.screenshot({
    fullPage: true,
    type: "png",
  });

  await page.close();

  await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(REPORT_JPG);

  await sharp(png)
    .resize({ width: 520, withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toFile(PREVIEW_JPG);
}

async function ensureImages() {
  if (!fs.existsSync(REPORT_JPG) || !fs.existsSync(PREVIEW_JPG)) {
    await makeReportImages();
  }
}

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

app.get("/report", (req, res) => {
  res.sendFile(REPORT_HTML);
});

app.get("/report.jpg", async (req, res) => {
  try {
    await ensureImages();
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(REPORT_JPG);
  } catch (e) {
    console.error("report.jpg error:", e);
    res.sendStatus(500);
  }
});

app.get("/report-preview.jpg", async (req, res) => {
  try {
    await ensureImages();
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(PREVIEW_JPG);
  } catch (e) {
    console.error("preview error:", e);
    res.sendStatus(500);
  }
});

async function replyLine(replyToken, messages) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + ACCESS_TOKEN,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    console.error("LINE reply failed:", response.status, await response.text());
  }
}

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-line-signature"];
      const body = req.body.toString("utf8");

      if (!CHANNEL_SECRET || !ACCESS_TOKEN) {
        console.error(
          "Thiếu LINE_CHANNEL_SECRET hoặc LINE_CHANNEL_ACCESS_TOKEN"
        );
        return res.sendStatus(500);
      }

      const expected = crypto
        .createHmac("sha256", CHANNEL_SECRET)
        .update(body)
        .digest("base64");

      if (!signature || expected !== signature) {
        return res.sendStatus(401);
      }

      const data = JSON.parse(body);

      for (const event of data.events || []) {
        if (
          event.type !== "message" ||
          !event.message ||
          event.message.type !== "text" ||
          !event.replyToken
        ) {
          continue;
        }

        const text = (event.message.text || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        if (text.includes("bc sức khỏe")) {
          await makeReportImages();

          const original = `${BASE_URL}/report.jpg?v=${Date.now()}`;
          const preview = `${BASE_URL}/report-preview.jpg?v=${Date.now()}`;
          const reportLink = `${BASE_URL}/report`;

          await replyLine(event.replyToken, [
            {
              type: "text",
              text: `📊 BC SỨC KHỎE\n\n💪 Bản mới nhất đã cập nhật.\n🟢 Màu sắc mạnh hơn · chữ/số nổi bật\n💻 HTML: ${reportLink}\n\n@all`,
            },
            {
              type: "image",
              originalContentUrl: original,
              previewImageUrl: preview,
            },
          ]);
        } else if (text === "hello" || text === "hi") {
          await replyLine(event.replyToken, [
            {
              type: "text",
              text: "Xin chào anh 👋\nGõ BC SỨC KHỎE để nhận báo cáo FULL.",
            },
          ]);
        } else {
          await replyLine(event.replyToken, [
            {
              type: "text",
              text: "Anh gõ BC SỨC KHỎE để nhận báo cáo FULL dạng hình ảnh.",
            },
          ]);
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error("Webhook error:", error);
      return res.sendStatus(500);
    }
  }
);

app.listen(PORT, async () => {
  console.log(`LINE Bot running on port ${PORT}`);
  console.log(`Report: ${BASE_URL}/report`);
  console.log(`Image: ${BASE_URL}/report.jpg`);
  console.log(`Preview: ${BASE_URL}/report-preview.jpg`);

  try {
    await makeReportImages();
    console.log("FULL report images created successfully.");
  } catch (e) {
    console.error("Initial report image error:", e);
  }
});
