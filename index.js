const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

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


// ==========================================
// TRANG CHỦ
// ==========================================

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});


// ==========================================
// BÁO CÁO HTML
// ==========================================

app.get("/report", (req, res) => {
  res.sendFile(REPORT_HTML);
});


// ==========================================
// TẠO ẢNH TỪ REPORT.HTML
// ==========================================

async function createReportImage() {

  if (!fs.existsSync(REPORT_HTML)) {
    throw new Error("Không tìm thấy report.html");
  }

  if (!browser) {

    browser = await puppeteer.launch({

      headless: true,

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]

    });

  }

  const page = await browser.newPage();


  await page.setViewport({

    width: 520,

    height: 900,

    deviceScaleFactor: 2

  });


  await page.goto(
    "file://" + REPORT_HTML,
    {
      waitUntil: "networkidle0"
    }
  );


  // Chờ JavaScript trong report.html
  // dựng biểu đồ và dữ liệu
  await new Promise(resolve => {
    setTimeout(resolve, 800);
  });


  await page.screenshot({

    path: REPORT_IMAGE,

    fullPage: true,

    type: "jpeg",

    quality: 88

  });


  await page.close();


  return REPORT_IMAGE;
}


// ==========================================
// URL ẢNH
// ==========================================

app.get("/report.jpg", (req, res) => {

  if (!fs.existsSync(REPORT_IMAGE)) {

    return res
      .status(404)
      .send("Ảnh báo cáo chưa được tạo");

  }


  res.setHeader(
    "Content-Type",
    "image/jpeg"
  );


  res.setHeader(
    "Cache-Control",
    "no-cache"
  );


  res.sendFile(REPORT_IMAGE);

});


// ==========================================
// GỬI TIN NHẮN LINE
// ==========================================

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

      "LINE reply error:",

      response.status,

      await response.text()

    );

  }

}


// ==========================================
// WEBHOOK LINE
// ==========================================

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
          "Thiếu LINE_CHANNEL_SECRET hoặc LINE_CHANNEL_ACCESS_TOKEN"
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


      const expectedSignature =
        crypto

          .createHmac(
            "sha256",
            CHANNEL_SECRET
          )

          .update(body)

          .digest("base64");


      if (
        expectedSignature !==
        signature
      ) {

        console.error(
          "Sai LINE signature"
        );

        return res.sendStatus(401);

      }


      const data =
        JSON.parse(body);


      for (
        const event of data.events || []
      ) {


        if (

          event.type !== "message" ||

          event.message?.type !==
            "text" ||

          !event.replyToken

        ) {

          continue;

        }


        const text =
          (event.message.text || "")

            .toLowerCase()

            .replace(/\s+/g, " ")

            .trim();


        // ==================================
        // BC SỨC KHỎE
        // ==================================

        if (
          text.includes("bc sức khỏe")
        ) {

          try {

            console.log(
              "Đang tạo ảnh BC SỨC KHỎE..."
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

                    "Em gửi anh ảnh báo cáo FULL " +
                    "theo mẫu cũ + data cũ 👇"

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
                    "🔗 Bản báo cáo đầy đủ:\n" +
                    reportUrl

                }

              ]

            );


          } catch (error) {

            console.error(
              "Lỗi tạo ảnh:",
              error
            );


            await replyLine(

              event.replyToken,

              [

                {

                  type: "text",

                  text:
                    "⚠️ Chưa tạo được ảnh báo cáo.\n\n" +

                    "Anh mở bản FULL tại:\n" +

                    BASE_URL +
                    "/report"

                }

              ]

            );

          }


          continue;

        }


        // ==================================
        // HELLO
        // ==================================

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

                  "Gõ BC SỨC KHỎE " +
                  "để nhận ảnh báo cáo."

              }

            ]

          );


          continue;

        }


        // ==================================
        // TIN NHẮN KHÁC
        // ==================================

        await replyLine(

          event.replyToken,

          [

            {

              type: "text",

              text:
                "Anh gõ BC SỨC KHỎE " +
                "để nhận ảnh báo cáo FULL nhé."

            }

          ]

        );

      }


      return res.sendStatus(200);


    } catch (error) {

      console.error(
        "Webhook error:",
        error
      );


      return res.sendStatus(500);

    }

  }

);


// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================

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
