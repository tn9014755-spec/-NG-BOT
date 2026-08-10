const express = require("express");
const crypto = require("crypto");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  "https://ng-bot-c0im.onrender.com";

// ===============================
// TRANG KIỂM TRA BOT
// ===============================
app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

// ===============================
// TẠO ẢNH BÁO CÁO
// ===============================
async function createReportImage() {

  const svg = `
  <svg width="1080" height="1500" xmlns="http://www.w3.org/2000/svg">

    <rect width="1080" height="1500" fill="#f4f7fb"/>

    <!-- HEADER -->
    <rect x="40" y="40" width="1000" height="180"
          rx="30" fill="#173f73"/>

    <text x="80" y="105"
          font-family="Arial"
          font-size="42"
          font-weight="bold"
          fill="white">
      📊 BC SỨC KHỎE
    </text>

    <text x="80" y="165"
          font-family="Arial"
          font-size="28"
          fill="#dcecff">
      BHX Mỹ Quới • Tháng 8/2026
    </text>

    <!-- DOANH THU -->
    <rect x="40" y="260" width="1000" height="230"
          rx="30" fill="white"/>

    <text x="80" y="325"
          font-family="Arial"
          font-size="30"
          font-weight="bold"
          fill="#333">
      DOANH THU LŨY KẾ T8
    </text>

    <text x="80" y="405"
          font-family="Arial"
          font-size="58"
          font-weight="bold"
          fill="#173f73">
      384.017.441 đ
    </text>

    <!-- OFFLINE -->
    <rect x="40" y="530" width="475" height="230"
          rx="30" fill="#eaf7ee"/>

    <text x="75" y="600"
          font-family="Arial"
          font-size="30"
          font-weight="bold"
          fill="#237a42">
      OFFLINE
    </text>

    <text x="75" y="675"
          font-family="Arial"
          font-size="42"
          font-weight="bold"
          fill="#237a42">
      348.290.960 đ
    </text>

    <text x="75" y="720"
          font-family="Arial"
          font-size="27"
          fill="#555">
      90,7% doanh thu
    </text>

    <!-- ONLINE -->
    <rect x="565" y="530" width="475" height="230"
          rx="30" fill="#eaf2ff"/>

    <text x="600" y="600"
          font-family="Arial"
          font-size="30"
          font-weight="bold"
          fill="#245fc1">
      ONLINE
    </text>

    <text x="600" y="675"
          font-family="Arial"
          font-size="42"
          font-weight="bold"
          fill="#245fc1">
      35.726.481 đ
    </text>

    <text x="600" y="720"
          font-family="Arial"
          font-size="27"
          fill="#555">
      9,3% doanh thu
    </text>

    <!-- THÔNG TIN -->
    <rect x="40" y="800" width="1000" height="250"
          rx="30" fill="white"/>

    <text x="80" y="865"
          font-family="Arial"
          font-size="30"
          font-weight="bold"
          fill="#333">
      THÔNG TIN CỬA HÀNG
    </text>

    <text x="80" y="925"
          font-family="Arial"
          font-size="28"
          fill="#555">
      BHX Mỹ Quới
    </text>

    <text x="80" y="975"
          font-family="Arial"
          font-size="28"
          fill="#555">
      Mã điểm bán: 28717
    </text>

    <!-- FOOTER -->
    <rect x="40" y="1100" width="1000" height="260"
          rx="30" fill="#173f73"/>

    <text x="80" y="1180"
          font-family="Arial"
          font-size="34"
          font-weight="bold"
          fill="white">
      TỔNG QUAN
    </text>

    <text x="80" y="1245"
          font-family="Arial"
          font-size="28"
          fill="#dcecff">
      Offline đang chiếm tỷ trọng chủ đạo.
    </text>

    <text x="80" y="1300"
          font-family="Arial"
          font-size="28"
          fill="#dcecff">
      Online đóng góp 9,3% doanh thu.
    </text>

    <text x="80" y="1390"
          font-family="Arial"
          font-size="25"
          fill="#bcd7f5">
      Báo cáo tự động từ LINE BOT
    </text>

  </svg>
  `;

  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// ===============================
// URL ẢNH BÁO CÁO
// ===============================
app.get("/report.png", async (req, res) => {
  try {
    const image = await createReportImage();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache");

    res.send(image);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// ===============================
// WEBHOOK LINE
// ===============================
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    try {

      const signature = req.headers["x-line-signature"];
      const body = req.body.toString("utf8");

      // Kiểm tra chữ ký LINE
      const hash = crypto
        .createHmac("sha256", CHANNEL_SECRET)
        .update(body)
        .digest("base64");

      if (hash !== signature) {
        console.log("Sai chữ ký LINE");
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

        const userMessage = event.message.text || "";

        const normalized = userMessage
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        // ===============================
        // BC SỨC KHỎE
        // ===============================
        if (normalized.includes("bc sức khỏe")) {

          const imageUrl = `${BASE_URL}/report.png`;

          const response = await fetch(
            "https://api.line.me/v2/bot/message/reply",
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + ACCESS_TOKEN
              },

              body: JSON.stringify({
                replyToken: event.replyToken,

                messages: [
                  {
                    type: "text",
                    text:
                      "📊 BC SỨC KHỎE đã sẵn sàng.\n\n" +
                      "Anh xem báo cáo hình ảnh ngay bên dưới 👇"
                  },

                  {
                    type: "image",
                    originalContentUrl: imageUrl,
                    previewImageUrl: imageUrl
                  }
                ]
              })
            }
          );

          console.log(
            "LINE reply status:",
            response.status
          );

          if (!response.ok) {
            console.error(await response.text());
          }

        }

        // ===============================
        // HELLO
        // ===============================
        else if (
          normalized === "hello" ||
          normalized === "hi"
        ) {

          await fetch(
            "https://api.line.me/v2/bot/message/reply",
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + ACCESS_TOKEN
              },

              body: JSON.stringify({
                replyToken: event.replyToken,

                messages: [
                  {
                    type: "text",
                    text: "Xin chào anh 👋"
                  }
                ]
              })
            }
          );

        }

        // ===============================
        // TỪ KHÓA KHÁC
        // ===============================
        else {

          await fetch(
            "https://api.line.me/v2/bot/message/reply",
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + ACCESS_TOKEN
              },

              body: JSON.stringify({
                replyToken: event.replyToken,

                messages: [
                  {
                    type: "text",
                    text:
                      "Anh vừa nhắn: " +
                      userMessage +
                      "\n\nGõ BC SỨC KHỎE để xem báo cáo."
                  }
                ]
              })
            }
          );

        }
      }

      return res.sendStatus(200);

    } catch (error) {

      console.error("Webhook error:", error);

      return res.sendStatus(500);
    }
  }
);

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {

  console.log(
    `LINE Bot running on port ${PORT}`
  );

  console.log(
    `Report image: ${BASE_URL}/report.png`
  );

});
