const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");
const Orders = require("../models/Order");
const crypto = require('crypto');
// Add this import at the top of your controller file
const emailService = require('../services/EmailServices');
// Generate a random alphanumeric string of 10 characters
function generateOrderCode(length = 10) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
}

// Create Payment Intent for Stripe
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'usd', bundleName, username, customerEmail  } = req.body;

    if (!amount || !bundleName || !username) {
      return res.status(400).json({
        message: "amount, bundleName, and username are required",
      });
    }

    // Generate local order code
    const order_code = `ORD-${generateOrderCode(10)}`;

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      receipt_email: customerEmail, // Add this line
      metadata: {
        username,
        bundleName,
        order_code,
        customerEmail, // Add this line
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("✅ Payment Intent created:", paymentIntent.id);

    res.status(200).json({
      message: "Payment Intent created successfully",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      order_code,
      amount: amount,
    });
  } catch (error) {
    console.error("❌ Error creating Payment Intent:", error.message);
    res.status(500).json({
      message: "Failed to create Payment Intent",
      error: error.message,
    });
  }
};

// Confirm payment and create eSIM order
const confirmPaymentAndCreateEsim = async (req, res) => {
  try {
    const { paymentIntentId, paymentMethod } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        message: "paymentIntentId is required",
      });
    }

    // First, confirm the payment with Stripe using the payment method details
    let paymentIntent;
    
    if (paymentMethod) {
      console.log("💳 Confirming payment with Stripe...");
      
      // Confirm the payment intent with the provided payment method
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: {
          type: 'card',
          card: {
            number: paymentMethod.card.number,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            cvc: paymentMethod.card.cvc,
          },
          billing_details: paymentMethod.billing_details,
        },
        return_url: 'https://your-website.com/return', // Add your return URL
      });
    } else {
      // Just retrieve the payment intent if no payment method provided
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    }

    console.log("Payment Intent Status:", paymentIntent.status);

    // Check if payment was successful
    if (paymentIntent.status !== 'succeeded') {
      // If payment requires additional action (like 3D Secure)
      if (paymentIntent.status === 'requires_action') {
        return res.status(200).json({
          success: false,
          status: paymentIntent.status,
          requires_action: true,
          payment_intent: {
            id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
            next_action: paymentIntent.next_action,
          },
          message: "Payment requires additional authentication",
        });
      }

      // If payment failed or requires payment method
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        status: paymentIntent.status,
        last_payment_error: paymentIntent.last_payment_error,
      });
    }

    const { username, bundleName, order_code } = paymentIntent.metadata;

    console.log("✅ Payment succeeded, creating eSIM order...");
    console.log("➡️ Username:", username);
    console.log("➡️ Bundle Name:", bundleName);
    console.log("➡️ Order Code:", order_code);

    // Now create the eSIM with the provider
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/orders";

    const providerPayload = {
      type: "transaction",
      assign: true,
      order: [
        {
          type: "bundle",
          quantity: 1,
          item: bundleName,
          iccid: "",
          allowReassign: false,
        },
      ],
    };

    // Call eSIM provider
    const response = await axios.post(BASE_URL, providerPayload, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Provider Response Status:", response.status);
    const providerData = response.data;

// Save order to database
let savedOrder = null;
if (providerData.status === "completed") {
  const newOrder = new Orders({
    username,
    order_code,
    provider_reference_code: providerData.orderReference,
    order: providerData.order,
    total: paymentIntent.amount / 100, // Convert from cents
    currency: paymentIntent.currency,
    status: providerData.status,
    statusMessage: providerData.statusMessage,
    orderReference: providerData.orderReference,
    createdDate: providerData.createdDate,
    assigned: providerData.assigned,
    paymentIntentId: paymentIntentId,
    paymentStatus: 'completed',
    customerEmail: paymentIntent.receipt_email || username, // Use username as fallback if it's an email
    bundleName: bundleName,
    esimData: {
      iccid: providerData.order && providerData.order[0] ? providerData.order[0].iccid : '',
      activationCode: providerData.order && providerData.order[0] ? providerData.order[0].activationCode : '',
      qrCodeUrl: providerData.order && providerData.order[0] ? providerData.order[0].qrCodeUrl : '',
    }
  });

  savedOrder = await newOrder.save();
  console.log("💾 Order saved in DB:", savedOrder._id);
  
  // 📧 Send confirmation email
  console.log("📧 Sending order confirmation email...");
  try {
    const emailResult = await emailService.sendEsimOrderConfirmation(savedOrder);
    if (emailResult.success) {
      console.log("✅ Confirmation email sent successfully to:", emailResult.recipient);
    } else {
      console.log("⚠️  Failed to send confirmation email:", emailResult.error || emailResult.message);
    }
  } catch (emailError) {
    console.error("❌ Error sending confirmation email:", emailError.message);
    // Don't fail the entire request if email fails
  }
}


    res.status(201).json({
      success: true,
      status: 'succeeded',
      message: "Payment confirmed and eSIM order created successfully",
      order_code,
      provider_reference_code: providerData.orderReference,
      paymentIntentId,
      providerResponse: providerData,
      savedOrder,
    });
  } catch (error) {
    console.error("❌ Error confirming payment and creating eSIM:", error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        message: "Your card was declined",
        error: error.message,
        decline_code: error.decline_code,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment and create eSIM",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

// Webhook endpoint for Stripe events
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
      
      // Update order status in database
      try {
        await Orders.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          { 
            paymentStatus: 'completed',
            status: 'paid',
            updatedAt: new Date()
          }
        );
      } catch (dbError) {
        console.error('❌ Error updating order status:', dbError);
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ PaymentIntent failed:', failedPayment.id);
      
      // Update order status in database
      try {
        await Orders.findOneAndUpdate(
          { paymentIntentId: failedPayment.id },
          { 
            paymentStatus: 'failed',
            status: 'payment_failed',
            updatedAt: new Date()
          }
        );
      } catch (dbError) {
        console.error('❌ Error updating failed payment status:', dbError);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      return res.status(400).json({
        message: "paymentIntentId is required",
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.status(200).json({
      message: "Payment status retrieved successfully",
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error("❌ Error retrieving payment status:", error.message);
    res.status(500).json({
      message: "Failed to retrieve payment status",
      error: error.message,
    });
  }
};

// Keep existing functions
const getEsimgoCatalogue = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
    const { countryCode } = req.query;
    
    console.log("🔌 MongoDB Connected: localhost");
    console.log("🌍 Fetching eSIMGO catalogue...");
    console.log("➡️ Country Code:", countryCode || "Not Provided");
    
    let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
    if (countryCode) {
      requestUrl += `&countries=${countryCode}`;
    }
    
    console.log("➡️ API URL:", requestUrl);
    console.log("➡️ Using API Key:", API_KEY ? "✅ Loaded" : "❌ Missing");
    
    const response = await axios.get(requestUrl, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    
    console.log("✅ API Response Status:", response.status);
    const { bundles } = response.data;
    
    const beautified = bundles.map((bundle) => ({
      name: bundle.name,
      provider: "esimgo",
      description: bundle.description,
      picture: bundle.imageUrl,
      data_quantity: bundle.dataAmount,
      duration: bundle.duration,
      price: bundle.price,
      countries: bundle.countries.map((c) => c.name),
      region: bundle.countries[0]?.region || null,
      speed: bundle.speed || [],
      autostart: bundle.autostart,
      unlimited: bundle.unlimited,
      billingType: bundle.billingType,
    }));
    
    console.log("📦 Total Bundles Fetched:", beautified.length);
    
    res.status(200).json({
      message: "Catalogue fetched successfully",
      total: beautified.length,
      bundles: beautified,
    });
  } catch (error) {
    console.error("❌ Error fetching catalogue");
    console.error("➡️ Status:", error.response?.status || "No status");
    console.error("➡️ Data:", error.response?.data || "No response data");
    console.error("➡️ Message:", error.message);
    
    res.status(500).json({
      message: "Failed to fetch catalogue",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

const getSpecificBundle = async (req, res) => {
  try {
    
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/catalogue/bundle";
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        message: "Bundle name is required in params (/bundle/:name)",
      });
    }
    
    console.log("🌍 Fetching Specific eSIMGO Bundle...");
    console.log("➡️ Bundle Name:", name);
    
    const requestUrl = `${BASE_URL}/${name}`;
    console.log("➡️ API URL:", requestUrl);
    
    const response = await axios.get(requestUrl, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    
    console.log("✅ API Response Status:", response.status);
    const bundle = response.data;
    
    const beautified = {
      name: bundle.name,
      description: bundle.description,
      provider: "esimgo",
      picture: bundle.imageUrl,
      price: bundle.price,
      data_quantity: bundle.dataAmount,
      duration: bundle.duration,
      speed: bundle.speed?.speeds || [],
      autostart: bundle.autostart,
      unlimited: bundle.unlimited,
      billingType: bundle.billingType,
      group: bundle.group || [],
      countries: bundle.countries.map((c) => ({
        name: c.country?.name,
        iso: c.country?.iso,
        region: c.country?.region,
        networks: c.networks.map((n) => ({
          name: n.name,
          brand: n.brandName,
          speeds: n.speeds,
        })),
      })),
      allowances: bundle.allowances || [],
    };
    
    res.status(200).json({
      message: "Bundle fetched successfully",
      bundle: beautified,
    });
  } catch (error) {
    console.error("❌ Error fetching bundle");
    console.error("➡️ Status:", error.response?.status || "No status");
    console.error("➡️ Data:", error.response?.data || "No response data");
    console.error("➡️ Message:", error.message);
    
    res.status(500).json({
      message: "Failed to fetch bundle",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/orders";
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        message: "Order ID is required in params (/orders/:orderId)",
      });
    }

    console.log("📋 Fetching eSIMGO Order Details...");
    console.log("➡️ Order ID:", orderId);

    const requestUrl = `${BASE_URL}/${encodeURIComponent(orderId)}`;
    console.log("➡️ API URL:", requestUrl);

    const response = await axios.get(requestUrl, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ API Response Status:", response.status);
    const order = response.data;

    const beautified = {
      orderId: order.orderId,
      bundleName: order.bundleName,
      quantity: order.quantity,
      status: order.status,
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      esims: order.esims?.map((esim) => ({
        iccid: esim.iccid,
        status: esim.status,
        activationCode: esim.activationCode,
        qrCodeUrl: esim.qrCodeUrl,
      })) || [],
    };

    res.status(200).json({
      message: "Order details fetched successfully",
      order: beautified,
    });
  } catch (error) {
    console.error("❌ Error fetching order details");
    console.error("➡️ Status:", error.response?.status || "No status");
    console.error("➡️ Data:", error.response?.data || "No response data");
    console.error("➡️ Message:", error.message);
    
    res.status(500).json({
      message: "Failed to fetch order details",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

const getEsimDetails = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/esims";
    const { iccid } = req.params;

    if (!iccid) {
      return res.status(400).json({
        message: "ICCID is required in params (/esims/:iccid)",
      });
    }

    console.log("📱 Fetching eSIM Details...");
    console.log("➡️ ICCID:", iccid);

    const requestUrl = `${BASE_URL}/${encodeURIComponent(iccid)}`;
    console.log("➡️ API URL:", requestUrl);

    const response = await axios.get(requestUrl, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ API Response Status:", response.status);
    const esim = response.data;

    const beautified = {
      iccid: esim.iccid,
      orderId: esim.orderId,
      bundleName: esim.bundleName,
      status: esim.status,
      activationCode: esim.activationCode,
      qrCodeUrl: esim.qrCodeUrl,
      createdAt: esim.createdAt,
      dataUsage: esim.dataUsage || null,
      startDate: esim.startDate || null,
      endDate: esim.endDate || null,
    };

    res.status(200).json({
      message: "eSIM details fetched successfully",
      esim: beautified,
    });
  } catch (error) {
    console.error("❌ Error fetching eSIM details");
    console.error("➡️ Status:", error.response?.status || "No status");
    console.error("➡️ Data:", error.response?.data || "No response data");
    console.error("➡️ Message:", error.message);
    
    res.status(500).json({
      message: "Failed to fetch eSIM details",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

module.exports = {
  getEsimgoCatalogue,
  getSpecificBundle,
  createPaymentIntent,
  confirmPaymentAndCreateEsim,
  handleStripeWebhook,
  getPaymentStatus,
  getOrderDetails,
  getEsimDetails,
};