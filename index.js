const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  "https://ng-bot-c0im.onrender.com";

const REPORT_HTML = path.join(__dirname, "report.html");
const REPORT_IMAGE = path.join(__dirname, "report.jpg");

let browser = null;

// =====================================
// TRANG CHỦ
// =====================================

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

// =====================================
// BÁO CÁO HTML
// =====================================

app.get("/report", (req, res) => {
  if (!fs.existsSync(REPORT_HTML)) {
    return res.status(404).send("Không tìm thấy report.html");
  }

  res.sendFile(REPORT_HTML);
});

// =====================================
// KHỞI ĐỘNG CHROMIUM
// =====================================

async function getBrowser() {

  if (browser) {
    return browser;
  }

  console.log("Đang khởi động Chromium...");

  const executablePath =
    await chromium.executablePath();

  console.log(
    "Chromium executable:",
    executablePath
  );

  browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],

    executablePath: executablePath,

    headless: true,

    ignoreHTTPSErrors: true
  });

  console.log("Chromium đã khởi động.");

  return browser;
}

// =====================================
// TẠO ẢNH BÁO CÁO
// =====================================

async function createReportImage() {

  console.log("===== BẮT ĐẦU TẠO ẢNH =====");

  if (!fs.existsSync(REPORT_HTML)) {
    throw new Error(
      "Không tìm thấy report.html"
    );
  }

  const br = await getBrowser();

  const page = await br.newPage();

  await page.setViewport({
    width: 520,
    height: 900,
    deviceScaleFactor: 2
  });

  const fileUrl =
    "file://" + REPORT_HTML;

  console.log(
    "Đang mở:",
    fileUrl
  );

  await page.goto(fileUrl, {
    waitUntil: "networkidle0",
    timeout: 60000
  });

  // Cho JavaScript trong report.html chạy
  await new Promise(resolve => {
    setTimeout(resolve, 1500);
  });

  await page.screenshot({
    path: REPORT_IMAGE,
    fullPage: true,
    type: "jpeg",
    quality: 85
  });

  await page.close();

  console.log(
    "ĐÃ TẠO ẢNH:",
    REPORT_IMAGE
  );

  return REPORT_IMAGE;
}

// =====================================
// URL ẢNH
// Nếu chưa có -> tự tạo
// =====================================

app.get("/report.jpg", async (req, res) => {

  try {

    if (!fs.existsSync(REPORT_IMAGE)) {

      console.log(
        "Chưa có report.jpg -> tạo mới..."
      );

      await createReportImage();

    }

    if (!fs.existsSync(REPORT_IMAGE)) {

      return res.status(500).send(
        "Không tạo được ảnh báo cáo"
      );

    }

    res.setHeader(
      "Content-Type",
      "image/jpeg"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );

    res.sendFile(REPORT_IMAGE);

  } catch (error) {

    console.error(
      "LỖI REPORT.JPG:"
    );

    console.error(error);

    res.status(500).send(
      "Lỗi tạo ảnh báo cáo: " +
      error.message
    );
  }
});

// =====================================
// GỬI LINE
// =====================================

async function replyLine(
  replyToken,
  messages
) {

  const response = await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "Authorization":
          "Bearer " + ACCESS_TOKEN
      },

      body: JSON.stringify({
        replyToken,
        messages
      })
    }
  );

  if (!response.ok) {

    console.error(
      "LINE ERROR:",
      response.status,
      await response.text()
    );
  }
}

// =====================================
// WEBHOOK
// =====================================

app.post(
  "/webhook",
  express.raw({
    type: "application/json"
  }),
  async (req, res) => {

    try {

      if (
        !CHANNEL_SECRET ||
        !ACCESS_TOKEN
      ) {

        console.error(
          "Thiếu LINE ENV"
        );

        return res.sendStatus(500);
      }

      const signature =
        req.headers["x-line-signature"];

      if (!signature) {
        return res.sendStatus(401);
      }

      const body =
        req.body.toString("utf8");

      const expected =
        crypto
          .createHmac(
            "sha256",
            CHANNEL_SECRET
          )
          .update(body)
          .digest("base64");

      if (
        expected !== signature
      ) {

        console.error(
          "Sai LINE signature"
        );

        return res.sendStatus(401);
      }

      const data =
        JSON.parse(body);

      for (
        const event of
        data.events || []
      ) {

        if (
          event.type !== "message" ||
          !event.message ||
          event.message.type !== "text" ||
          !event.replyToken
        ) {
          continue;
        }

        const text =
          (event.message.text || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        // =================================
        // BC SỨC KHỎE
        // =================================

        if (
          text.includes("bc sức khỏe")
        ) {

          try {

            console.log(
              "NHẬN BC SỨC KHỎE"
            );

            await createReportImage();

            const imageUrl =
              BASE_URL +
              "/report.jpg?v=" +
              Date.now();

            const reportUrl =
              BASE_URL +
              "/report";

            await replyLine(
              event.replyToken,
              [

                {
                  type: "text",

                  text:
                    "📊 BC SỨC KHỎE\n\n" +
                    "BHX Mỹ Qưới · 28717\n\n" +
                    "Báo cáo FULL theo mẫu cũ + data cũ 👇"
                },

                {
                  type: "image",

                  originalContentUrl:
                    imageUrl,

                  previewImageUrl:
                    imageUrl
                },

                {
                  type: "text",

                  text:
                    "🔗 Bản đầy đủ:\n" +
                    reportUrl
                }

              ]
            );

            console.log(
              "ĐÃ GỬI ẢNH CHO LINE"
            );

          } catch (error) {

            console.error(
              "LỖI TẠO ẢNH:"
            );

            console.error(error);

            await replyLine(
              event.replyToken,
              [
                {
                  type: "text",

                  text:
                    "⚠️ Chưa tạo được ảnh.\n\n" +
                    "Anh mở:\n" +
                    BASE_URL +
                    "/report.jpg"
                }
              ]
            );
          }

          continue;
        }

        // =================================
        // HELLO
        // =================================

        if (
          text === "hello" ||
          text === "hi" ||
          text === "xin chào"
        ) {

          await replyLine(
            event.replyToken,
            [
              {
                type: "text",
                text:
                  "Xin chào anh 👋\n\n" +
                  "Gõ BC SỨC KHỎE để nhận ảnh báo cáo."
              }
            ]
          );

          continue;
        }

        // =================================
        // KHÁC
        // =================================

        await replyLine(
          event.replyToken,
          [
            {
              type: "text",

              text:
                "Anh gõ BC SỨC KHỎE để nhận ảnh báo cáo FULL nhé."
            }
          ]
        );
      }

      return res.sendStatus(200);

    } catch (error) {

      console.error(
        "WEBHOOK ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);

// =====================================
// START
// =====================================

app.listen(
  PORT,
  () => {

    console.log(
      "================================"
    );

    console.log(
      "LINE BOT STARTED"
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "REPORT:",
      BASE_URL + "/report"
    );

    console.log(
      "IMAGE:",
      BASE_URL + "/report.jpg"
    );

    console.log(
      "================================"
    );
  }
);
