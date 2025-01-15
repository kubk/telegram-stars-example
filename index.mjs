
import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Map is used to keep track of users who have paid. In a production scenario, replace with a robust database solution.
const paidUsers = new Map();

/*
    Handles the /start command.
    Sends a welcome message to the user and explains the available commands for interacting with the bot.
*/
bot.command("start", (ctx) =>
  ctx.reply(
    `Welcome! I am a simple bot that can accept payments via Telegram Stars. The following commands are available:

/pay - to pay
/status - to check payment status
/refund - to refund payment`,
  ),
);

/*
    Handles the /pay command.
    Generates an invoice that users can click to make a payment. The invoice includes the product name, description, and payment options.
    Note: Replace "Test Product", "Test description", and other placeholders with actual values in production.
*/
bot.command("pay", (ctx) => {
  return ctx.replyWithInvoice(
    "Test Product",                  // Product name
    "Test description",              // Product description
    "{}",                            // Payload (replace with meaningful data)
    "XTR",                           // Currency
    [{ amount: 1, label: "Test Product" }], // Price breakdown
  );
});

/*
    Handles the pre_checkout_query event.
    Telegram sends this event to the bot when a user clicks the payment button.
    The bot must respond with answerPreCheckoutQuery within 10 seconds to confirm or cancel the transaction.
*/
bot.on("pre_checkout_query", (ctx) => {
  return ctx.answerPreCheckoutQuery(true).catch(() => {
    console.error("answerPreCheckoutQuery failed");
  });
});

/*
    Handles the message:successful_payment event.
    This event is triggered when a payment is successfully processed.
    Updates the paidUsers map to record the payment details and logs the successful payment.
*/
bot.on("message:successful_payment", (ctx) => {
  if (!ctx.message || !ctx.message.successful_payment || !ctx.from) {
    return;
  }

  paidUsers.set(
    ctx.from.id,                                     // User ID
    ctx.message.successful_payment.telegram_payment_charge_id, // Payment ID
  );

  console.log(ctx.message.successful_payment); // Logs payment details
});

/*
    Handles the /status command.
    Checks if the user has made a payment and responds with their payment status.
*/
bot.command("status", (ctx) => {
  const message = paidUsers.has(ctx.from.id)
    ? "You have paid"            // User has paid
    : "You have not paid yet";   // User has not paid
  return ctx.reply(message);
});

/*
    Handles the /refund command.
    Refunds the payment made by the user if applicable. If the user hasn't paid, informs them that no refund is possible.
*/
bot.command("refund", (ctx) => {
  const userId = ctx.from.id;
  if (!paidUsers.has(userId)) {
    return ctx.reply("You have not paid yet, there is nothing to refund");
  }

  ctx.api
    .refundStarPayment(userId, paidUsers.get(userId)) // Initiates the refund
    .then(() => {
      paidUsers.delete(userId); // Removes the user from the paidUsers map
      return ctx.reply("Refund successful");
    })
    .catch(() => ctx.reply("Refund failed")); // Handles refund errors
});

// Starts the bot and makes it ready to receive updates and process commands.
bot.start();
