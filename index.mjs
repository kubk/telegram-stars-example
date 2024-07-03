import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Map is used for simplicity. For production use a database
const paidUsers = new Map();

bot.command("start", (ctx) =>
  ctx.reply(
    `Welcome! I am a simple bot that can accept payments via Telegram Stars. The following commands are available:

/pay - to pay
/status - to check payment status
/refund - to refund payment`,
  ),
);

bot.command("pay", (ctx) => {
  return ctx.replyWithInvoice("Test Product", "Test description", "{}", "XTR", [
    { amount: 1, label: "Test Product" },
  ]);
});

bot.on("pre_checkout_query", (ctx) => {
  return ctx.answerPreCheckoutQuery(true).catch(() => {
    console.error("answerPreCheckoutQuery failed");
  });
});

bot.on("message:successful_payment", (ctx) => {
  if (!ctx.message || !ctx.message.successful_payment || !ctx.from) {
    return;
  }

  paidUsers.set(
    ctx.from.id,
    ctx.message.successful_payment.telegram_payment_charge_id,
  );

  console.log(ctx.message.successful_payment);
});

bot.command("status", (ctx) => {
  const message = paidUsers.has(ctx.from.id)
    ? "You have paid"
    : "You have not paid yet";
  return ctx.reply(message);
});

bot.command("refund", (ctx) => {
  const userId = ctx.from.id;
  if (!paidUsers.has(userId)) {
    return ctx.reply("You have not paid yet, there is nothing to refund");
  }

  ctx.api
    .refundStarPayment(userId, paidUsers.get(userId))
    .then(() => {
      paidUsers.delete(userId);
      return ctx.reply("Refund successful");
    })
    .catch(() => ctx.reply("Refund failed"));
});

bot.start();
