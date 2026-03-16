import { Bot, InputFile } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const paidUsers = new Map();

bot.command("start", (ctx) =>
  ctx.reply(
    `Welcome! I am a simple bot that can accept payments via Telegram Stars. The following commands are available:

/pay - to pay
/payPhoto - to pay for photo
/status - to check payment status
/refund - to refund payment`,
  ),
);

bot.command("pay", (ctx) => {
  return ctx.replyWithInvoice(
    "Test Product", // Product name
    "Test description", // Product description
    "{}", // Payload (replace with meaningful data)
    "XTR", // Currency
    [{ amount: 1, label: "Test Product" }], // Price breakdown
  );
});

bot.command('payPhoto', async (ctx) => {
  // https://github.com/go-telegram/bot/blob/476693b75db8643919aafd6f284990ea64d3fa41/examples/send_paid_media/main.go#L71
  await bot.api.sendPaidMedia(ctx.from.id, 1, [
    {
      type: 'photo',
      media: 'https://telegram.org/img/t_logo.png',
    }
  ])
})

bot.on("pre_checkout_query", (ctx) => {
  console.log('pre checkout query');
  return ctx.answerPreCheckoutQuery(true).catch(() => {
    console.error("answerPreCheckoutQuery failed");
  });
});

bot.on("message:successful_payment", (ctx) => {
  console.log('message:successful_payment')
  if (!ctx.message || !ctx.message.successful_payment || !ctx.from) {
    return;
  }

  ctx.reply('Payment successful')

  console.log(ctx.message)

  paidUsers.set(
    ctx.from.id, // User ID
    ctx.message.successful_payment.telegram_payment_charge_id, // Payment ID
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
