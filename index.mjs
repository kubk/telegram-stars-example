import { Bot } from "grammy";
import logger from "./logger.js";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Map to track users who have paid
const paidUsers = new Map();

logger.info("Bot is starting...");


// Log all interactions
bot.use(async (ctx, next) => {
  const user = ctx.from ? `${ctx.from.username || ctx.from.id}` : "unknown";
  const text = ctx.message?.text || "non-text interaction";
  logger.info(`User: ${user}, Interaction: ${text}`);
  await next();
});


// Log specific commands
bot.command("start", (ctx) => {
  const user = ctx.from.username || ctx.from.id;
  logger.info(`User ${user} used /start command.`);
  ctx.reply(`Welcome! I am a simple bot that can accept payments via Telegram Stars. The following commands are available:

  /pay - to pay
  /status - to check payment status
  /refund - to refund payment`);
});


// Log when a user initiates payment
bot.command("pay", (ctx) => {
  const user = ctx.from.username || ctx.from.id;
  logger.info(`User ${user} initiated /pay command.`);
  return ctx.replyWithInvoice(
    "Test Productttttttt",                    // Product name
    "Test description",                       // Product description
    JSON.stringify({ userId: ctx.from.id }),  // Payload with user information
    "XTR",                                    // Currency
    [{ amount: 2, label: "Test Product" }]    // Price breakdown
  );
});


// Log pre-checkout queries
bot.on("pre_checkout_query", (ctx) => {
  const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
  logger.info(`Pre-checkout query received for User ID: ${payload.userId}`);
  return ctx.answerPreCheckoutQuery(true).catch(() => {
    logger.error("Failed to answer pre-checkout query");
  });
});


// Log successful payments
bot.on("message:successful_payment", (ctx) => {
  if (!ctx.message || !ctx.message.successful_payment || !ctx.from) {
    return;
  }
  
  const payment = ctx.message.successful_payment;
  logger.info(`Invoice Payload: ${payment.invoice_payload}`);

  const userId = ctx.from.id;
  const paymentId = payment.telegram_payment_charge_id;
  const totalAmount = payment.total_amount; 

  // Initialize user payments array if not present
  if (!paidUsers.has(userId)) {
    paidUsers.set(userId, []);
  }

  // Add the new payment record
  paidUsers.get(userId).push({
    paymentId,
    amount: totalAmount,
    timestamp: new Date().toISOString(),
  });

  logger.info(
    `Payment successful. User ID: ${userId}, Payment ID: ${paymentId}, Amount: ${totalAmount} Stars`
  );

  ctx.reply(`Thank you for your payment of ${totalAmount} Stars!`);
});


/*
    Handles the /status command.
    Checks if the user has made a payment and responds with their payment status.
*/
bot.command("status", (ctx) => {
  const user = ctx.from.username || ctx.from.id;

  if (paidUsers.has(ctx.from.id)) {
    const payments = paidUsers.get(ctx.from.id);

    // Ensure payments is an array before performing reduce
    if (Array.isArray(payments)) {
      const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
      logger.info(
        `User ${user} checked payment status: User has paid a total of ⭐ ${totalAmount} Stars.`
      );
      ctx.reply(`You have made ${payments.length} payment(s) totaling ⭐ ${totalAmount} Stars.`);
    } else {
      logger.error(`Payments for user ${user} is not an array.`);
      ctx.reply("There was an error retrieving your payment status. Please try again.");
    }
  } else {
    logger.info(`User ${user} checked payment status: User has not paid.`);
    ctx.reply("You have not paid yet.");
  }
});


/*
  Handles the /refund command.
  Refunds the payment made by the user if applicable. If the user hasn't paid, informs them that no refund is possible.
*/
bot.command("refund", async (ctx) => {
  const userId = ctx.from.id;

  if (!paidUsers.has(userId)) {
    logger.info(`User ${userId} requested a refund but has not paid.`);
    return ctx.reply("You have not paid yet, there is nothing to refund.");
  }

  const payments = paidUsers.get(userId);
  if (!payments || payments.length === 0) {
    logger.info(`No valid payments found for refund. User ID: ${userId}`);
    return ctx.reply("There are no valid payments to refund.");
  }

  // Get the most recent payment
  const lastPayment = payments[payments.length - 1]; // Peek at the last payment without removing it
  logger.info(
    `Refund requested for User ID: ${userId}, Payment ID: ${lastPayment.paymentId}, Amount: ${lastPayment.amount}`
  );

  // Process the refund logic
  try {
    await ctx.api.refundStarPayment(userId, lastPayment.paymentId); // If supported in your setup
    payments.pop(); // Remove the refunded payment from the array
    if (payments.length === 0) {
      paidUsers.delete(userId); // Remove user if no payments remain
    } else {
      paidUsers.set(userId, payments); // Update payments map
    }

    logger.info(`Refund processed successfully for Payment ID: ${lastPayment.paymentId}`);
    return ctx.reply(`Refund of ⭐ ${lastPayment.amount} Stars has been successfully processed.`);
  } catch (error) {
    logger.error(`Refund failed for Payment ID: ${lastPayment.paymentId}, Error: ${error.message}`);
    return ctx.reply("Refund failed. Please contact support.");
  }
});


// Start the bot
bot.start();
