const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// LINE CONFIG
// ===============================
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ===============================
// BASE URL
// ===============================
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  "https://ng-bot-c0im.onrender.com";

// ===============================
// TRANG CHỦ
// ===============================
app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

// ===============================
// BÁO CÁO
// ===============================
app.get("/report", (req, res) => {
  res.sendFile(path.join(__dirname, "report.html"));
});

// ===============================
// WEBHOOK LINE
// ===============================
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // -------------------------------
      // Kiểm tra cấu hình
      // -------------------------------
      if (!CHANNEL_SECRET || !ACCESS_TOKEN) {
        console.error("Thiếu LINE_CHANNEL_SECRET hoặc LINE_CHANNEL_ACCESS_TOKEN");
        return res.sendStatus(500);
      }

      // -------------------------------
      // Lấy chữ ký LINE
      // -------------------------------
      const signature = req.headers["x-line-signature"];

      if (!signature) {
        console.error("Không có x-line-signature");
        return res.sendStatus(401);
      }

      // -------------------------------
      // Lấy body nguyên bản
      // -------------------------------
      const body = req.body.toString("utf8");

      // -------------------------------
      // Tạo chữ ký SHA256
      // -------------------------------
      const hash = crypto
        .createHmac("sha256", CHANNEL_SECRET)
        .update(body)
        .digest("base64");

      // -------------------------------
      // So sánh chữ ký
      // -------------------------------
      if (hash !== signature) {
        console.error("LINE signature không hợp lệ");
        return res.sendStatus(401);
      }

      // -------------------------------
      // Đọc dữ liệu LINE
      // -------------------------------
      const data = JSON.parse(body);

      // -------------------------------
      // Xử lý từng event
      // -------------------------------
      for (const event of data.events || []) {
        if (
          event.type !== "message" ||
          !event.message ||
          event.message.type !== "text" ||
          !event.replyToken
        ) {
          continue;
        }

        // -------------------------------
        // Tin nhắn người dùng
        // -------------------------------
        const userMessage = event.message.text || "";

        // Chuẩn hóa
        const normalized = userMessage
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        let replyText = "";

        // ===============================
        // BC SỨC KHỎE
        // ===============================
        if (normalized.includes("bc sức khỏe")) {
          replyText =
            "📊 BC SỨC KHỎE đã sẵn sàng.\n\n" +
            "BHX Mỹ Qưới · 28717\n" +
            "Doanh thu lũy kế T8: 358.964.170 đ\n" +
            "Offline: 326.172.970 đ (90,9%)\n" +
            "Online: 32.791.200 đ (9,1%)\n\n" +
            "👉 Xem báo cáo chi tiết:\n" +
            BASE_URL +
            "/report";
        }

        // ===============================
        // HELLO
        // ===============================
        else if (
          normalized === "hello" ||
          normalized === "hi" ||
          normalized === "xin chào"
        ) {
          replyText = "Xin chào anh 👋";
        }

        // ===============================
        // TRƯỜNG HỢP KHÁC
        // ===============================
        else {
          replyText =
            "Anh vừa nhắn: " +
            userMessage +
            "\n\nGõ \"BC SỨC KHỎE\" để xem báo cáo anh nhé.";
        }

        // ===============================
        // GỌI LINE REPLY API
        // ===============================
        const response = await fetch(
          "https://api.line.me/v2/bot/message/reply",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + ACCESS_TOKEN
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
          }
        );

        // -------------------------------
        // Kiểm tra phản hồi LINE
        // -------------------------------
        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            "LINE reply failed:",
            response.status,
            errorText
          );
        }
      }

      // -------------------------------
      // Báo LINE webhook thành công
      // -------------------------------
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
  console.log("LINE Bot running on port " + PORT);
  console.log("Report: " + BASE_URL + "/report");
});
