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


// ======================================
// TRANG CHỦ
// ======================================

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});


// ======================================
// BÁO CÁO HTML
// ======================================

app.get("/report", (req, res) => {

  if (!fs.existsSync(REPORT_HTML)) {
    return res.status(404).send(
      "Không tìm thấy report.html"
    );
  }

  res.sendFile(REPORT_HTML);

});


// ======================================
// ẢNH BÁO CÁO
// ======================================

app.get("/report.jpg", (req, res) => {

  if (!fs.existsSync(REPORT_IMAGE)) {
    return res.status(404).send(
      "Ảnh báo cáo chưa được tạo"
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

});


// ======================================
// MỞ CHROME
// ======================================

async function getBrowser() {

  if (browser) {
    return browser;
  }

  console.log("Đang khởi động Chromium...");

  const executablePath =
    await chromium.executablePath();

  console.log(
    "Chromium:",
    executablePath
  );

  browser =
    await puppeteer.launch({

      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ],

      defaultViewport:
        chromium.defaultViewport,

      executablePath:
        executablePath,

      headless: true,

      ignoreHTTPSErrors: true

    });

  console.log(
    "Chromium đã khởi động."
  );

  return browser;
}


// ======================================
// TẠO ẢNH TỪ REPORT.HTML
// ======================================

async function createReportImage() {

  console.log(
    "Bắt đầu tạo ảnh báo cáo..."
  );

  if (!fs.existsSync(REPORT_HTML)) {

    throw new Error(
      "Không tìm thấy report.html"
    );

  }

  const browser =
    await getBrowser();

  const page =
    await browser.newPage();


  // Kích thước giống giao diện mobile
  await page.setViewport({

    width: 520,

    height: 900,

    deviceScaleFactor: 2

  });


  const reportFile =
    "file://" +
    REPORT_HTML;


  console.log(
    "Đang mở:",
    reportFile
  );


  await page.goto(

    reportFile,

    {
      waitUntil:
        "networkidle0",

      timeout:
        60000

    }

  );


  // Chờ JS trong HTML chạy
  await new Promise(
    resolve =>
      setTimeout(resolve, 1000)
  );


  // Chụp toàn bộ chiều dài báo cáo
  await page.screenshot({

    path:
      REPORT_IMAGE,

    fullPage:
      true,

    type:
      "jpeg",

    quality:
      88

  });


  await page.close();


  console.log(
    "Đã tạo:",
    REPORT_IMAGE
  );


  return REPORT_IMAGE;
}


// ======================================
// GỬI TIN NHẮN LINE
// ======================================

async function replyLine(
  replyToken,
  messages
) {

  const response =
    await fetch(

      "https://api.line.me/v2/bot/message/reply",

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "Authorization":
            "Bearer " +
            ACCESS_TOKEN

        },

        body:
          JSON.stringify({

            replyToken:

              replyToken,

            messages:

              messages

          })

      }

    );


  if (!response.ok) {

    console.error(

      "LINE reply error:",

      response.status,

      await response.text()

    );

  }

}


// ======================================
// WEBHOOK LINE
// ======================================

app.post(

  "/webhook",

  express.raw({
    type: "application/json"
  }),

  async (req, res) => {

    try {

      // -------------------------------
      // Kiểm tra cấu hình
      // -------------------------------

      if (
        !CHANNEL_SECRET ||
        !ACCESS_TOKEN
      ) {

        console.error(
          "Thiếu LINE ENV"
        );

        return res.sendStatus(500);

      }


      // -------------------------------
      // Chữ ký LINE
      // -------------------------------

      const signature =
        req.headers[
          "x-line-signature"
        ];


      if (!signature) {

        return res.sendStatus(401);

      }


      const body =
        req.body.toString(
          "utf8"
        );


      const expected =
        crypto

          .createHmac(
            "sha256",
            CHANNEL_SECRET
          )

          .update(body)

          .digest("base64");


      if (
        expected !==
        signature
      ) {

        console.error(
          "Sai LINE signature"
        );

        return res.sendStatus(401);

      }


      const data =
        JSON.parse(body);


      // -------------------------------
      // Xử lý event
      // -------------------------------

      for (
        const event of
        data.events || []
      ) {


        if (

          event.type !==
            "message" ||

          !event.message ||

          event.message.type !==
            "text" ||

          !event.replyToken

        ) {

          continue;

        }


        const text =
          (
            event.message.text ||
            ""
          )

            .toLowerCase()

            .replace(
              /\s+/g,
              " "
            )

            .trim();


        // =================================
        // BC SỨC KHỎE
        // =================================

        if (
          text.includes(
            "bc sức khỏe"
          )
        ) {

          try {

            console.log(
              "================================"
            );

            console.log(
              "NHẬN BC SỨC KHỎE"
            );

            console.log(
              "Đang tạo ảnh..."
            );


            await createReportImage();


            const imageUrl =
              BASE_URL +
              "/report.jpg?v=" +
              Date.now();


            const reportUrl =
              BASE_URL +
              "/report";


            console.log(
              "Ảnh:",
              imageUrl
            );


            await replyLine(

              event.replyToken,

              [

                {

                  type:
                    "text",

                  text:
                    "📊 BC SỨC KHỎE\n\n" +
                    "BHX Mỹ Qưới · 28717\n\n" +
                    "Em gửi anh báo cáo FULL " +
                    "theo mẫu cũ + data cũ 👇"

                },

                {

                  type:
                    "image",

                  originalContentUrl:
                    imageUrl,

                  previewImageUrl:
                    imageUrl

                },

                {

                  type:
                    "text",

                  text:
                    "🔗 Bản đầy đủ:\n" +
                    reportUrl

                }

              ]

            );


            console.log(
              "ĐÃ GỬI ẢNH CHO LINE"
            );

          }

          catch (error) {

            console.error(
              "LỖI TẠO ẢNH:"
            );

            console.error(
              error
            );


            await replyLine(

              event.replyToken,

              [

                {

                  type:
                    "text",

                  text:
                    "⚠️ Không tạo được ảnh báo cáo.\n\n" +
                    "Anh mở bản FULL tại:\n" +
                    BASE_URL +
                    "/report"

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

          text ===
            "xin chào"

        ) {

          await replyLine(

            event.replyToken,

            [

              {

                type:
                  "text",

                text:
                  "Xin chào anh 👋\n\n" +
                  "Gõ BC SỨC KHỎE " +
                  "để nhận ảnh báo cáo."

              }

            ]

          );


          continue;

        }


        // =================================
        // TIN NHẮN KHÁC
        // =================================

        await replyLine(

          event.replyToken,

          [

            {

              type:
                "text",

              text:
                "Anh gõ BC SỨC KHỎE " +
                "để nhận ảnh báo cáo FULL nhé."

            }

          ]

        );

      }


      return res.sendStatus(200);


    }

    catch (error) {

      console.error(
        "WEBHOOK ERROR:"
      );

      console.error(
        error
      );

      return res.sendStatus(500);

    }

  }

);


// ======================================
// START SERVER
// ======================================

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
      "REPORT:"
    );

    console.log(
      BASE_URL +
      "/report"
    );

    console.log(
      "IMAGE:"
    );

    console.log(
      BASE_URL +
      "/report.jpg"
    );

    console.log(
      "================================"
    );

  }

);
