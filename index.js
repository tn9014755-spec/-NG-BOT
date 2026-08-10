const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-line-signature"];
    const body = req.body.toString();

    // Kiểm tra chữ ký từ LINE
    const hash = crypto
      .createHmac("sha256", CHANNEL_SECRET)
      .update(body)
      .digest("base64");

    if (hash !== signature) {
      return res.sendStatus(401);
    }

    const data = JSON.parse(body);

    for (const event of data.events || []) {
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;

        let replyText = "Anh vừa nhắn: " + userMessage;

        // Trả lời theo từ khóa
        if (userMessage.toLowerCase() === "hello") {
          replyText = "Xin chào anh 👋";
        }

        if (userMessage.toUpperCase() === "BC SỨC KHỎE") {
          replyText = "Em đã nhận lệnh BC SỨC KHỎE. Đang chuẩn bị báo cáo...";
        }

        await fetch("https://api.line.me/v2/bot/message/reply", {
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
                text: replyText
              }
            ]
          })
        });
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`LINE Bot running on port ${PORT}`);
});
