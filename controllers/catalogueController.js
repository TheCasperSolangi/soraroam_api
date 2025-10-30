// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const axios = require("axios");
// const Orders = require("../models/Order");
// const crypto = require('crypto');
// // Add this import at the top of your controller file
// const emailService = require('../services/EmailServices');
// // Generate a random alphanumeric string of 10 characters
// function generateOrderCode(length = 10) {
//   return crypto.randomBytes(Math.ceil(length / 2))
//     .toString('hex')
//     .slice(0, length)
//     .toUpperCase();
// }

// // Create Payment Intent for Stripe
// const createPaymentIntent = async (req, res) => {
//   try {
//     const { amount, currency = 'usd', bundleName, username, customerEmail  } = req.body;

//     if (!amount || !bundleName || !username) {
//       return res.status(400).json({
//         message: "amount, bundleName, and username are required",
//       });
//     }

//     // Generate local order code
//     const order_code = `ORD-${generateOrderCode(10)}`;

//     // Create payment intent with Stripe
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(amount * 100), // Convert to cents
//       currency: currency.toLowerCase(),
//       receipt_email: customerEmail, // Add this line
//       metadata: {
//         username,
//         bundleName,
//         order_code,
//         customerEmail, // Add this line
//       },
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     console.log("✅ Payment Intent created:", paymentIntent.id);

//     res.status(200).json({
//       message: "Payment Intent created successfully",
//       clientSecret: paymentIntent.client_secret,
//       paymentIntentId: paymentIntent.id,
//       order_code,
//       amount: amount,
//     });
//   } catch (error) {
//     console.error("❌ Error creating Payment Intent:", error.message);
//     res.status(500).json({
//       message: "Failed to create Payment Intent",
//       error: error.message,
//     });
//   }
// };

// // Confirm payment and create eSIM order
// const confirmPaymentAndCreateEsim = async (req, res) => {
//   try {
//     const { paymentIntentId, paymentMethod } = req.body;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     // First, confirm the payment with Stripe using the payment method details
//     let paymentIntent;
    
//     if (paymentMethod) {
//       console.log("💳 Confirming payment with Stripe...");
      
//       // Confirm the payment intent with the provided payment method
//       paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
//         payment_method: {
//           type: 'card',
//           card: {
//             number: paymentMethod.card.number,
//             exp_month: paymentMethod.card.exp_month,
//             exp_year: paymentMethod.card.exp_year,
//             cvc: paymentMethod.card.cvc,
//           },
//           billing_details: paymentMethod.billing_details,
//         },
//         return_url: 'https://your-website.com/return', // Add your return URL
//       });
//     } else {
//       // Just retrieve the payment intent if no payment method provided
//       paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//     }

//     console.log("Payment Intent Status:", paymentIntent.status);

//     // Check if payment was successful
//     if (paymentIntent.status !== 'succeeded') {
//       // If payment requires additional action (like 3D Secure)
//       if (paymentIntent.status === 'requires_action') {
//         return res.status(200).json({
//           success: false,
//           status: paymentIntent.status,
//           requires_action: true,
//           payment_intent: {
//             id: paymentIntent.id,
//             client_secret: paymentIntent.client_secret,
//             next_action: paymentIntent.next_action,
//           },
//           message: "Payment requires additional authentication",
//         });
//       }

//       // If payment failed or requires payment method
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//         status: paymentIntent.status,
//         last_payment_error: paymentIntent.last_payment_error,
//       });
//     }

//     const { username, bundleName, order_code } = paymentIntent.metadata;

//     console.log("✅ Payment succeeded, creating eSIM order...");
//     console.log("➡️ Username:", username);
//     console.log("➡️ Bundle Name:", bundleName);
//     console.log("➡️ Order Code:", order_code);

//     // Now create the eSIM with the provider
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";

//     const providerPayload = {
//       type: "transaction",
//       assign: true,
//       order: [
//         {
//           type: "bundle",
//           quantity: 1,
//           item: bundleName,
//           iccid: "",
//           allowReassign: false,
//         },
//       ],
//     };

//     // Call eSIM provider
//     const response = await axios.post(BASE_URL, providerPayload, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ Provider Response Status:", response.status);
//     const providerData = response.data;

// // Save order to database
// let savedOrder = null;
// if (providerData.status === "completed") {
//   const newOrder = new Orders({
//     username,
//     order_code,
//     provider_reference_code: providerData.orderReference,
//     order: providerData.order,
//     total: paymentIntent.amount / 100, // Convert from cents
//     currency: paymentIntent.currency,
//     status: providerData.status,
//     statusMessage: providerData.statusMessage,
//     orderReference: providerData.orderReference,
//     createdDate: providerData.createdDate,
//     assigned: providerData.assigned,
//     paymentIntentId: paymentIntentId,
//     paymentStatus: 'completed',
//     customerEmail: paymentIntent.receipt_email || username, // Use username as fallback if it's an email
//     bundleName: bundleName,
//     esimData: {
//       iccid: providerData.order && providerData.order[0] ? providerData.order[0].iccid : '',
//       activationCode: providerData.order && providerData.order[0] ? providerData.order[0].activationCode : '',
//       qrCodeUrl: providerData.order && providerData.order[0] ? providerData.order[0].qrCodeUrl : '',
//     }
//   });

//   savedOrder = await newOrder.save();
//   console.log("💾 Order saved in DB:", savedOrder._id);
  
//   // 📧 Send confirmation email
//   console.log("📧 Sending order confirmation email...");
//   try {
//     const emailResult = await emailService.sendEsimOrderConfirmation(savedOrder);
//     if (emailResult.success) {
//       console.log("✅ Confirmation email sent successfully to:", emailResult.recipient);
//     } else {
//       console.log("⚠️  Failed to send confirmation email:", emailResult.error || emailResult.message);
//     }
//   } catch (emailError) {
//     console.error("❌ Error sending confirmation email:", emailError.message);
//     // Don't fail the entire request if email fails
//   }
// }


//     res.status(201).json({
//       success: true,
//       status: 'succeeded',
//       message: "Payment confirmed and eSIM order created successfully",
//       order_code,
//       provider_reference_code: providerData.orderReference,
//       paymentIntentId,
//       providerResponse: providerData,
//       savedOrder,
//     });
//   } catch (error) {
//     console.error("❌ Error confirming payment and creating eSIM:", error);
    
//     // Handle specific Stripe errors
//     if (error.type === 'StripeCardError') {
//       return res.status(400).json({
//         success: false,
//         message: "Your card was declined",
//         error: error.message,
//         decline_code: error.decline_code,
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: "Failed to confirm payment and create eSIM",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// // Webhook endpoint for Stripe events
// const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.log(`❌ Webhook signature verification failed:`, err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // Handle the event
//   switch (event.type) {
//     case 'payment_intent.succeeded':
//       const paymentIntent = event.data.object;
//       console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: paymentIntent.id },
//           { 
//             paymentStatus: 'completed',
//             status: 'paid',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating order status:', dbError);
//       }
//       break;

//     case 'payment_intent.payment_failed':
//       const failedPayment = event.data.object;
//       console.log('❌ PaymentIntent failed:', failedPayment.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: failedPayment.id },
//           { 
//             paymentStatus: 'failed',
//             status: 'payment_failed',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating failed payment status:', dbError);
//       }
//       break;

//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   res.json({ received: true });
// };

// // Get payment status
// const getPaymentStatus = async (req, res) => {
//   try {
//     const { paymentIntentId } = req.params;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//     res.status(200).json({
//       message: "Payment status retrieved successfully",
//       status: paymentIntent.status,
//       amount: paymentIntent.amount / 100,
//       currency: paymentIntent.currency,
//       metadata: paymentIntent.metadata,
//     });
//   } catch (error) {
//     console.error("❌ Error retrieving payment status:", error.message);
//     res.status(500).json({
//       message: "Failed to retrieve payment status",
//       error: error.message,
//     });
//   }
// };

// // Keep existing functions
// const getEsimgoCatalogue = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
//     const { countryCode } = req.query;
    
//     console.log("🔌 MongoDB Connected: localhost");
//     console.log("🌍 Fetching eSIMGO catalogue...");
//     console.log("➡️ Country Code:", countryCode || "Not Provided");
    
//     let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
//     if (countryCode) {
//       requestUrl += `&countries=${countryCode}`;
//     }
    
//     console.log("➡️ API URL:", requestUrl);
//     console.log("➡️ Using API Key:", API_KEY ? "✅ Loaded" : "❌ Missing");
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const { bundles } = response.data;
    
//     const beautified = bundles.map((bundle) => ({
//       name: bundle.name,
//       provider: "esimgo",
//       description: bundle.description,
//       picture: bundle.imageUrl,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       price: bundle.price,
//       countries: bundle.countries.map((c) => c.name),
//       region: bundle.countries[0]?.region || null,
//       speed: bundle.speed || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//     }));
    
//     console.log("📦 Total Bundles Fetched:", beautified.length);
    
//     res.status(200).json({
//       message: "Catalogue fetched successfully",
//       total: beautified.length,
//       bundles: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching catalogue");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch catalogue",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getSpecificBundle = async (req, res) => {
//   try {
    
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue/bundle";
//     const { name } = req.params;
    
//     if (!name) {
//       return res.status(400).json({
//         message: "Bundle name is required in params (/bundle/:name)",
//       });
//     }
    
//     console.log("🌍 Fetching Specific eSIMGO Bundle...");
//     console.log("➡️ Bundle Name:", name);
    
//     const requestUrl = `${BASE_URL}/${name}`;
//     console.log("➡️ API URL:", requestUrl);
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const bundle = response.data;
    
//     const beautified = {
//       name: bundle.name,
//       description: bundle.description,
//       provider: "esimgo",
//       picture: bundle.imageUrl,
//       price: bundle.price,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       speed: bundle.speed?.speeds || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//       group: bundle.group || [],
//       countries: bundle.countries.map((c) => ({
//         name: c.country?.name,
//         iso: c.country?.iso,
//         region: c.country?.region,
//         networks: c.networks.map((n) => ({
//           name: n.name,
//           brand: n.brandName,
//           speeds: n.speeds,
//         })),
//       })),
//       allowances: bundle.allowances || [],
//     };
    
//     res.status(200).json({
//       message: "Bundle fetched successfully",
//       bundle: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching bundle");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch bundle",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getOrderDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";
//     const { orderId } = req.params;

//     if (!orderId) {
//       return res.status(400).json({
//         message: "Order ID is required in params (/orders/:orderId)",
//       });
//     }

//     console.log("📋 Fetching eSIMGO Order Details...");
//     console.log("➡️ Order ID:", orderId);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(orderId)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const order = response.data;

//     const beautified = {
//       orderId: order.orderId,
//       bundleName: order.bundleName,
//       quantity: order.quantity,
//       status: order.status,
//       totalPrice: order.totalPrice,
//       createdAt: order.createdAt,
//       updatedAt: order.updatedAt,
//       esims: order.esims?.map((esim) => ({
//         iccid: esim.iccid,
//         status: esim.status,
//         activationCode: esim.activationCode,
//         qrCodeUrl: esim.qrCodeUrl,
//       })) || [],
//     };

//     res.status(200).json({
//       message: "Order details fetched successfully",
//       order: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching order details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch order details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getEsimDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/esims";
//     const { iccid } = req.params;

//     if (!iccid) {
//       return res.status(400).json({
//         message: "ICCID is required in params (/esims/:iccid)",
//       });
//     }

//     console.log("📱 Fetching eSIM Details...");
//     console.log("➡️ ICCID:", iccid);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(iccid)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const esim = response.data;

//     const beautified = {
//       iccid: esim.iccid,
//       orderId: esim.orderId,
//       bundleName: esim.bundleName,
//       status: esim.status,
//       activationCode: esim.activationCode,
//       qrCodeUrl: esim.qrCodeUrl,
//       createdAt: esim.createdAt,
//       dataUsage: esim.dataUsage || null,
//       startDate: esim.startDate || null,
//       endDate: esim.endDate || null,
//     };

//     res.status(200).json({
//       message: "eSIM details fetched successfully",
//       esim: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching eSIM details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch eSIM details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// module.exports = {
//   getEsimgoCatalogue,
//   getSpecificBundle,
//   createPaymentIntent,
//   confirmPaymentAndCreateEsim,
//   handleStripeWebhook,
//   getPaymentStatus,
//   getOrderDetails,
//   getEsimDetails,
// };

// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const axios = require("axios");
// const Orders = require("../models/Order");
// const crypto = require('crypto');
// // Add this import at the top of your controller file
// const emailService = require('../services/EmailServices');

// // Commission rates configuration for different data packages
// const COMMISSION_RATES = {
//   // Zone-based commission rates (as percentages)
//   zones: {
//     'zone_1': {
//       '7days_1gb': 25,      // 25% commission
//       '15days_2gb': 30,     // 30% commission
//       '30days_3gb': 35,     // 35% commission
//       '30days_5gb': 40,     // 40% commission
//       '30days_10gb': 45,    // 45% commission
//       '30days_20gb': 50,    // 50% commission
//       '30days_50gb': 55,    // 55% commission
//       '30days_100gb': 60,   // 60% commission
//       'unlimited': 65       // 65% commission
//     },
//     'zone_2': {
//       '7days_1gb': 20,
//       '15days_2gb': 25,
//       '30days_3gb': 30,
//       '30days_5gb': 35,
//       '30days_10gb': 40,
//       '30days_20gb': 45,
//       '30days_50gb': 50,
//       '30days_100gb': 55,
//       'unlimited': 60
//     },
//     'zone_3': {
//       '7days_1gb': 15,
//       '15days_2gb': 20,
//       '30days_3gb': 25,
//       '30days_5gb': 30,
//       '30days_10gb': 35,
//       '30days_20gb': 40,
//       '30days_50gb': 45,
//       '30days_100gb': 50,
//       'unlimited': 55
//     }
//   },
//   // Default commission rates if zone-based rates are not found
//   default: {
//     '7days_1gb': 20,
//     '15days_2gb': 25,
//     '30days_3gb': 30,
//     '30days_5gb': 35,
//     '30days_10gb': 40,
//     '30days_20gb': 45,
//     '30days_50gb': 50,
//     '30days_100gb': 55,
//     'unlimited': 60
//   }
// };

// // Zone mapping for different regions/countries
// const ZONE_MAPPING = {
//   'Europe': 'zone_1',
//   'North America': 'zone_1',
//   'Asia': 'zone_2',
//   'Middle East': 'zone_2',
//   'Africa': 'zone_3',
//   'South America': 'zone_3',
//   'Oceania': 'zone_2'
// };

// // Generate a random alphanumeric string of 10 characters
// function generateOrderCode(length = 10) {
//   return crypto.randomBytes(Math.ceil(length / 2))
//     .toString('hex')
//     .slice(0, length)
//     .toUpperCase();
// }

// // Helper function to categorize bundle based on data amount and duration
// function categorizeBundleType(bundle) {
//   const dataAmount = parseFloat(bundle.dataAmount) || 0;
//   const duration = parseInt(bundle.duration) || 0;
//   const isUnlimited = bundle.unlimited || false;

//   if (isUnlimited) {
//     return 'unlimited';
//   }

//   // Categorize based on duration and data amount
//   if (duration <= 7 && dataAmount <= 1) {
//     return '7days_1gb';
//   } else if (duration <= 15 && dataAmount <= 2) {
//     return '15days_2gb';
//   } else if (duration <= 30 && dataAmount <= 3) {
//     return '30days_3gb';
//   } else if (duration <= 30 && dataAmount <= 5) {
//     return '30days_5gb';
//   } else if (duration <= 30 && dataAmount <= 10) {
//     return '30days_10gb';
//   } else if (duration <= 30 && dataAmount <= 20) {
//     return '30days_20gb';
//   } else if (duration <= 30 && dataAmount <= 50) {
//     return '30days_50gb';
//   } else if (duration <= 30 && dataAmount <= 100) {
//     return '30days_100gb';
//   }

//   // Default to highest category if doesn't match
//   return '30days_100gb';
// }

// // Helper function to determine zone based on countries
// function determineZone(countries) {
//   if (!countries || countries.length === 0) {
//     return 'zone_3'; // Default to most conservative zone
//   }

//   // Get the first country's region
//   const firstCountryRegion = countries[0].region;
//   return ZONE_MAPPING[firstCountryRegion] || 'zone_3';
// }

// // Price-based Commission Middleware
// const applyCommissionMiddleware = (bundles, provider = 'esimgo') => {
//   if (provider !== 'esimgo') {
//     return bundles; // No commission for other providers
//   }

//   return bundles.map(bundle => {
//     try {
//       // Determine the zone based on bundle countries
//       const zone = determineZone(bundle.countries);
      
//       // Categorize the bundle type
//       const bundleType = categorizeBundleType(bundle);
      
//       // Get commission rate
//       const zoneRates = COMMISSION_RATES.zones[zone] || COMMISSION_RATES.default;
//       const commissionRate = zoneRates[bundleType] || zoneRates['30days_100gb']; // Default fallback
      
//       // Calculate original and new price
//       const originalPrice = parseFloat(bundle.price) || 0;
//       const commissionMultiplier = 1 + (commissionRate / 100);
//       const newPrice = Math.round((originalPrice * commissionMultiplier) * 100) / 100; // Round to 2 decimals
      
//       console.log(`📊 Commission Applied - Bundle: ${bundle.name}`);
//       console.log(`➡️ Zone: ${zone}, Type: ${bundleType}, Rate: ${commissionRate}%`);
//       console.log(`➡️ Original Price: $${originalPrice} → New Price: $${newPrice}`);

//       return {
//         ...bundle,
//         originalPrice: originalPrice, // Keep track of original price
//         price: newPrice,
//         commissionInfo: {
//           zone: zone,
//           bundleType: bundleType,
//           commissionRate: commissionRate,
//           commissionAmount: newPrice - originalPrice
//         }
//       };
//     } catch (error) {
//       console.error(`❌ Error applying commission to bundle ${bundle.name}:`, error);
//       return bundle; // Return original bundle if error occurs
//     }
//   });
// };

// // Single Bundle Commission Middleware
// const applySingleBundleCommission = (bundle, provider = 'esimgo') => {
//   if (provider !== 'esimgo') {
//     return bundle;
//   }

//   try {
//     // For single bundle, we need to handle the countries array differently
//     const countries = bundle.countries || [];
//     const zone = determineZone(countries);
//     const bundleType = categorizeBundleType(bundle);
    
//     const zoneRates = COMMISSION_RATES.zones[zone] || COMMISSION_RATES.default;
//     const commissionRate = zoneRates[bundleType] || zoneRates['30days_100gb'];
    
//     const originalPrice = parseFloat(bundle.price) || 0;
//     const commissionMultiplier = 1 + (commissionRate / 100);
//     const newPrice = Math.round((originalPrice * commissionMultiplier) * 100) / 100;
    
//     console.log(`📊 Single Bundle Commission Applied - ${bundle.name}`);
//     console.log(`➡️ Zone: ${zone}, Type: ${bundleType}, Rate: ${commissionRate}%`);
//     console.log(`➡️ Original Price: $${originalPrice} → New Price: $${newPrice}`);

//     return {
//       ...bundle,
//       originalPrice: originalPrice,
//       price: newPrice,
//       commissionInfo: {
//         zone: zone,
//         bundleType: bundleType,
//         commissionRate: commissionRate,
//         commissionAmount: newPrice - originalPrice
//       }
//     };
//   } catch (error) {
//     console.error(`❌ Error applying commission to single bundle ${bundle.name}:`, error);
//     return bundle;
//   }
// };

// // Create Payment Intent for Stripe
// const createPaymentIntent = async (req, res) => {
//   try {
//     const { amount, currency = 'usd', bundleName, username, customerEmail  } = req.body;

//     if (!amount || !bundleName || !username) {
//       return res.status(400).json({
//         message: "amount, bundleName, and username are required",
//       });
//     }

//     // Generate local order code
//     const order_code = `ORD-${generateOrderCode(10)}`;

//     // Create payment intent with Stripe
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(amount * 100), // Convert to cents
//       currency: currency.toLowerCase(),
//       receipt_email: customerEmail, // Add this line
//       metadata: {
//         username,
//         bundleName,
//         order_code,
//         customerEmail, // Add this line
//       },
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     console.log("✅ Payment Intent created:", paymentIntent.id);

//     res.status(200).json({
//       message: "Payment Intent created successfully",
//       clientSecret: paymentIntent.client_secret,
//       paymentIntentId: paymentIntent.id,
//       order_code,
//       amount: amount,
//     });
//   } catch (error) {
//     console.error("❌ Error creating Payment Intent:", error.message);
//     res.status(500).json({
//       message: "Failed to create Payment Intent",
//       error: error.message,
//     });
//   }
// };

// // Confirm payment and create eSIM order
// const confirmPaymentAndCreateEsim = async (req, res) => {
//   try {
//     const { paymentIntentId, paymentMethod } = req.body;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     // First, confirm the payment with Stripe using the payment method details
//     let paymentIntent;
    
//     if (paymentMethod) {
//       console.log("💳 Confirming payment with Stripe...");
      
//       // Confirm the payment intent with the provided payment method
//       paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
//         payment_method: {
//           type: 'card',
//           card: {
//             number: paymentMethod.card.number,
//             exp_month: paymentMethod.card.exp_month,
//             exp_year: paymentMethod.card.exp_year,
//             cvc: paymentMethod.card.cvc,
//           },
//           billing_details: paymentMethod.billing_details,
//         },
//         return_url: 'https://your-website.com/return', // Add your return URL
//       });
//     } else {
//       // Just retrieve the payment intent if no payment method provided
//       paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//     }

//     console.log("Payment Intent Status:", paymentIntent.status);

//     // Check if payment was successful
//     if (paymentIntent.status !== 'succeeded') {
//       // If payment requires additional action (like 3D Secure)
//       if (paymentIntent.status === 'requires_action') {
//         return res.status(200).json({
//           success: false,
//           status: paymentIntent.status,
//           requires_action: true,
//           payment_intent: {
//             id: paymentIntent.id,
//             client_secret: paymentIntent.client_secret,
//             next_action: paymentIntent.next_action,
//           },
//           message: "Payment requires additional authentication",
//         });
//       }

//       // If payment failed or requires payment method
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//         status: paymentIntent.status,
//         last_payment_error: paymentIntent.last_payment_error,
//       });
//     }

//     const { username, bundleName, order_code } = paymentIntent.metadata;

//     console.log("✅ Payment succeeded, creating eSIM order...");
//     console.log("➡️ Username:", username);
//     console.log("➡️ Bundle Name:", bundleName);
//     console.log("➡️ Order Code:", order_code);

//     // Now create the eSIM with the provider
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";

//     const providerPayload = {
//       type: "transaction",
//       assign: true,
//       order: [
//         {
//           type: "bundle",
//           quantity: 1,
//           item: bundleName,
//           iccid: "",
//           allowReassign: false,
//         },
//       ],
//     };

//     // Call eSIM provider
//     const response = await axios.post(BASE_URL, providerPayload, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ Provider Response Status:", response.status);
//     const providerData = response.data;

// // Save order to database
// let savedOrder = null;
// if (providerData.status === "completed") {
//   const newOrder = new Orders({
//     username,
//     order_code,
//     provider_reference_code: providerData.orderReference,
//     order: providerData.order,
//     total: paymentIntent.amount / 100, // Convert from cents
//     currency: paymentIntent.currency,
//     status: providerData.status,
//     statusMessage: providerData.statusMessage,
//     orderReference: providerData.orderReference,
//     createdDate: providerData.createdDate,
//     assigned: providerData.assigned,
//     paymentIntentId: paymentIntentId,
//     paymentStatus: 'completed',
//     customerEmail: paymentIntent.receipt_email || username, // Use username as fallback if it's an email
//     bundleName: bundleName,
//     esimData: {
//       iccid: providerData.order && providerData.order[0] ? providerData.order[0].iccid : '',
//       activationCode: providerData.order && providerData.order[0] ? providerData.order[0].activationCode : '',
//       qrCodeUrl: providerData.order && providerData.order[0] ? providerData.order[0].qrCodeUrl : '',
//     }
//   });

//   savedOrder = await newOrder.save();
//   console.log("💾 Order saved in DB:", savedOrder._id);
  
//   // 📧 Send confirmation email
//   console.log("📧 Sending order confirmation email...");
//   try {
//     const emailResult = await emailService.sendEsimOrderConfirmation(savedOrder);
//     if (emailResult.success) {
//       console.log("✅ Confirmation email sent successfully to:", emailResult.recipient);
//     } else {
//       console.log("⚠️  Failed to send confirmation email:", emailResult.error || emailResult.message);
//     }
//   } catch (emailError) {
//     console.error("❌ Error sending confirmation email:", emailError.message);
//     // Don't fail the entire request if email fails
//   }
// }


//     res.status(201).json({
//       success: true,
//       status: 'succeeded',
//       message: "Payment confirmed and eSIM order created successfully",
//       order_code,
//       provider_reference_code: providerData.orderReference,
//       paymentIntentId,
//       providerResponse: providerData,
//       savedOrder,
//     });
//   } catch (error) {
//     console.error("❌ Error confirming payment and creating eSIM:", error);
    
//     // Handle specific Stripe errors
//     if (error.type === 'StripeCardError') {
//       return res.status(400).json({
//         success: false,
//         message: "Your card was declined",
//         error: error.message,
//         decline_code: error.decline_code,
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: "Failed to confirm payment and create eSIM",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// // Webhook endpoint for Stripe events
// const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.log(`❌ Webhook signature verification failed:`, err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // Handle the event
//   switch (event.type) {
//     case 'payment_intent.succeeded':
//       const paymentIntent = event.data.object;
//       console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: paymentIntent.id },
//           { 
//             paymentStatus: 'completed',
//             status: 'paid',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating order status:', dbError);
//       }
//       break;

//     case 'payment_intent.payment_failed':
//       const failedPayment = event.data.object;
//       console.log('❌ PaymentIntent failed:', failedPayment.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: failedPayment.id },
//           { 
//             paymentStatus: 'failed',
//             status: 'payment_failed',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating failed payment status:', dbError);
//       }
//       break;

//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   res.json({ received: true });
// };

// // Get payment status
// const getPaymentStatus = async (req, res) => {
//   try {
//     const { paymentIntentId } = req.params;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//     res.status(200).json({
//       message: "Payment status retrieved successfully",
//       status: paymentIntent.status,
//       amount: paymentIntent.amount / 100,
//       currency: paymentIntent.currency,
//       metadata: paymentIntent.metadata,
//     });
//   } catch (error) {
//     console.error("❌ Error retrieving payment status:", error.message);
//     res.status(500).json({
//       message: "Failed to retrieve payment status",
//       error: error.message,
//     });
//   }
// };

// // Modified getEsimgoCatalogue with commission middleware
// const getEsimgoCatalogue = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
//     const { countryCode } = req.query;
    
//     console.log("🔌 MongoDB Connected: localhost");
//     console.log("🌍 Fetching eSIMGO catalogue...");
//     console.log("➡️ Country Code:", countryCode || "Not Provided");
    
//     let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
//     if (countryCode) {
//       requestUrl += `&countries=${countryCode}`;
//     }
    
//     console.log("➡️ API URL:", requestUrl);
//     console.log("➡️ Using API Key:", API_KEY ? "✅ Loaded" : "❌ Missing");
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const { bundles } = response.data;
    
//     const beautified = bundles.map((bundle) => ({
//       name: bundle.name,
//       provider: "esimgo",
//       description: bundle.description,
//       picture: bundle.imageUrl,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       price: bundle.price,
//       countries: bundle.countries.map((c) => c.name),
//       region: bundle.countries[0]?.region || null,
//       speed: bundle.speed || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//     }));
    
//     // Apply commission middleware
//     console.log("💰 Applying commission rates...");
//     const bundlesWithCommission = applyCommissionMiddleware(beautified, "esimgo");
    
//     console.log("📦 Total Bundles Fetched:", bundlesWithCommission.length);
    
//     res.status(200).json({
//       message: "Catalogue fetched successfully",
//       total: bundlesWithCommission.length,
//       bundles: bundlesWithCommission,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching catalogue");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch catalogue",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// // Modified getSpecificBundle with commission middleware
// const getSpecificBundle = async (req, res) => {
//   try {
    
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue/bundle";
//     const { name } = req.params;
    
//     if (!name) {
//       return res.status(400).json({
//         message: "Bundle name is required in params (/bundle/:name)",
//       });
//     }
    
//     console.log("🌍 Fetching Specific eSIMGO Bundle...");
//     console.log("➡️ Bundle Name:", name);
    
//     const requestUrl = `${BASE_URL}/${name}`;
//     console.log("➡️ API URL:", requestUrl);
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const bundle = response.data;
    
//     const beautified = {
//       name: bundle.name,
//       description: bundle.description,
//       provider: "esimgo",
//       picture: bundle.imageUrl,
//       price: bundle.price,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       speed: bundle.speed?.speeds || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//       group: bundle.group || [],
//       countries: bundle.countries.map((c) => ({
//         name: c.country?.name,
//         iso: c.country?.iso,
//         region: c.country?.region,
//         networks: c.networks.map((n) => ({
//           name: n.name,
//           brand: n.brandName,
//           speeds: n.speeds,
//         })),
//       })),
//       allowances: bundle.allowances || [],
//     };
    
//     // Apply commission middleware for single bundle
//     console.log("💰 Applying commission rates to single bundle...");
//     const bundleWithCommission = applySingleBundleCommission(beautified, "esimgo");
    
//     res.status(200).json({
//       message: "Bundle fetched successfully",
//       bundle: bundleWithCommission,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching bundle");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch bundle",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getOrderDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";
//     const { orderId } = req.params;

//     if (!orderId) {
//       return res.status(400).json({
//         message: "Order ID is required in params (/orders/:orderId)",
//       });
//     }

//     console.log("📋 Fetching eSIMGO Order Details...");
//     console.log("➡️ Order ID:", orderId);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(orderId)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const order = response.data;

//     const beautified = {
//       orderId: order.orderId,
//       bundleName: order.bundleName,
//       quantity: order.quantity,
//       status: order.status,
//       totalPrice: order.totalPrice,
//       createdAt: order.createdAt,
//       updatedAt: order.updatedAt,
//       esims: order.esims?.map((esim) => ({
//         iccid: esim.iccid,
//         status: esim.status,
//         activationCode: esim.activationCode,
//         qrCodeUrl: esim.qrCodeUrl,
//       })) || [],
//     };

//     res.status(200).json({
//       message: "Order details fetched successfully",
//       order: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching order details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch order details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getEsimDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/esims";
//     const { iccid } = req.params;

//     if (!iccid) {
//       return res.status(400).json({
//         message: "ICCID is required in params (/esims/:iccid)",
//       });
//     }

//     console.log("📱 Fetching eSIM Details...");
//     console.log("➡️ ICCID:", iccid);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(iccid)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const esim = response.data;

//     const beautified = {
//       iccid: esim.iccid,
//       orderId: esim.orderId,
//       bundleName: esim.bundleName,
//       status: esim.status,
//       activationCode: esim.activationCode,
//       qrCodeUrl: esim.qrCodeUrl,
//       createdAt: esim.createdAt,
//       dataUsage: esim.dataUsage || null,
//       startDate: esim.startDate || null,
//       endDate: esim.endDate || null,
//     };

//     res.status(200).json({
//       message: "eSIM details fetched successfully",
//       esim: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching eSIM details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch eSIM details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// module.exports = {
//   getEsimgoCatalogue,
//   getSpecificBundle,
//   createPaymentIntent,
//   confirmPaymentAndCreateEsim,
//   handleStripeWebhook,
//   getPaymentStatus,
//   getOrderDetails,
//   getEsimDetails,
//   // Export middleware functions for potential reuse
//   applyCommissionMiddleware,
//   applySingleBundleCommission,
//   COMMISSION_RATES,
//   ZONE_MAPPING
// };

// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const axios = require("axios");
// const Orders = require("../models/Order");
// const crypto = require('crypto');
// // Add this import at the top of your controller file
// const emailService = require('../services/EmailServices');

// // Commission rates configuration based on plan types (not zones)
// const COMMISSION_RATES = {
//   '7days_1gb': 25,      // 25% commission for 7-day 1GB plans
//   '15days_2gb': 30,     // 30% commission for 15-day 2GB plans
//   '30days_3gb': 35,     // 35% commission for 30-day 3GB plans
//   '30days_5gb': 40,     // 40% commission for 30-day 5GB plans
//   '30days_10gb': 45,    // 45% commission for 30-day 10GB plans
//   '30days_20gb': 50,    // 50% commission for 30-day 20GB plans
//   '30days_50gb': 55,    // 55% commission for 30-day 50GB plans
//   '30days_100gb': 60,   // 60% commission for 30-day 100GB plans
//   'unlimited': 65       // 65% commission for unlimited plans
// };

// // Remove zone-related configuration as we're using plan-based commission
// // This configuration is no longer needed

// // Generate a random alphanumeric string of 10 characters
// function generateOrderCode(length = 10) {
//   return crypto.randomBytes(Math.ceil(length / 2))
//     .toString('hex')
//     .slice(0, length)
//     .toUpperCase();
// }

// // Helper function to categorize bundle based on data amount and duration
// function categorizeBundleType(bundle) {
//   const dataAmount = parseFloat(bundle.dataAmount) || 0;
//   const duration = parseInt(bundle.duration) || 0;
//   const isUnlimited = bundle.unlimited || false;

//   if (isUnlimited) {
//     return 'unlimited';
//   }

//   // Categorize based on duration and data amount
//   if (duration <= 7 && dataAmount <= 1) {
//     return '7days_1gb';
//   } else if (duration <= 15 && dataAmount <= 2) {
//     return '15days_2gb';
//   } else if (duration <= 30 && dataAmount <= 3) {
//     return '30days_3gb';
//   } else if (duration <= 30 && dataAmount <= 5) {
//     return '30days_5gb';
//   } else if (duration <= 30 && dataAmount <= 10) {
//     return '30days_10gb';
//   } else if (duration <= 30 && dataAmount <= 20) {
//     return '30days_20gb';
//   } else if (duration <= 30 && dataAmount <= 50) {
//     return '30days_50gb';
//   } else if (duration <= 30 && dataAmount <= 100) {
//     return '30days_100gb';
//   }

//   // Default to highest category if doesn't match
//   return '30days_100gb';
// }

// // Price-based Commission Middleware - Based on plan type only
// const applyCommissionMiddleware = (bundles, provider = 'esimgo') => {
//   if (provider !== 'esimgo') {
//     return bundles; // No commission for other providers
//   }

//   return bundles.map(bundle => {
//     try {
//       // Categorize the bundle type based on data and duration
//       const bundleType = categorizeBundleType(bundle);
      
//       // Get commission rate directly from plan type
//       const commissionRate = COMMISSION_RATES[bundleType] || COMMISSION_RATES['30days_100gb']; // Default fallback
      
//       // Calculate original and new price
//       const originalPrice = parseFloat(bundle.price) || 0;
//       const commissionMultiplier = 1 + (commissionRate / 100);
//       const newPrice = Math.round((originalPrice * commissionMultiplier) * 100) / 100; // Round to 2 decimals
      
//       console.log(`📊 Commission Applied - Bundle: ${bundle.name}`);
//       console.log(`➡️ Plan Type: ${bundleType}, Rate: ${commissionRate}%`);
//       console.log(`➡️ Original Price: ${originalPrice} → New Price: ${newPrice}`);

//       return {
//         ...bundle,
//         originalPrice: originalPrice, // Keep track of original price
//         price: newPrice,
//         commissionInfo: {
//           bundleType: bundleType,
//           commissionRate: commissionRate,
//           commissionAmount: newPrice - originalPrice
//         }
//       };
//     } catch (error) {
//       console.error(`❌ Error applying commission to bundle ${bundle.name}:`, error);
//       return bundle; // Return original bundle if error occurs
//     }
//   });
// };

// // Single Bundle Commission Middleware - Based on plan type only
// const applySingleBundleCommission = (bundle, provider = 'esimgo') => {
//   if (provider !== 'esimgo') {
//     return bundle;
//   }

//   try {
//     // Categorize bundle type based on data and duration
//     const bundleType = categorizeBundleType(bundle);
    
//     // Get commission rate directly from plan type
//     const commissionRate = COMMISSION_RATES[bundleType] || COMMISSION_RATES['30days_100gb'];
    
//     const originalPrice = parseFloat(bundle.price) || 0;
//     const commissionMultiplier = 1 + (commissionRate / 100);
//     const newPrice = Math.round((originalPrice * commissionMultiplier) * 100) / 100;
    
//     console.log(`📊 Single Bundle Commission Applied - ${bundle.name}`);
//     console.log(`➡️ Plan Type: ${bundleType}, Rate: ${commissionRate}%`);
//     console.log(`➡️ Original Price: ${originalPrice} → New Price: ${newPrice}`);

//     return {
//       ...bundle,
//       originalPrice: originalPrice,
//       price: newPrice,
//       commissionInfo: {
//         bundleType: bundleType,
//         commissionRate: commissionRate,
//         commissionAmount: newPrice - originalPrice
//       }
//     };
//   } catch (error) {
//     console.error(`❌ Error applying commission to single bundle ${bundle.name}:`, error);
//     return bundle;
//   }
// };

// // Create Payment Intent for Stripe
// const createPaymentIntent = async (req, res) => {
//   try {
//     const { amount, currency = 'usd', bundleName, username, customerEmail  } = req.body;

//     if (!amount || !bundleName || !username) {
//       return res.status(400).json({
//         message: "amount, bundleName, and username are required",
//       });
//     }

//     // Generate local order code
//     const order_code = `ORD-${generateOrderCode(10)}`;

//     // Create payment intent with Stripe
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(amount * 100), // Convert to cents
//       currency: currency.toLowerCase(),
//       receipt_email: customerEmail, // Add this line
//       metadata: {
//         username,
//         bundleName,
//         order_code,
//         customerEmail, // Add this line
//       },
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     console.log("✅ Payment Intent created:", paymentIntent.id);

//     res.status(200).json({
//       message: "Payment Intent created successfully",
//       clientSecret: paymentIntent.client_secret,
//       paymentIntentId: paymentIntent.id,
//       order_code,
//       amount: amount,
//     });
//   } catch (error) {
//     console.error("❌ Error creating Payment Intent:", error.message);
//     res.status(500).json({
//       message: "Failed to create Payment Intent",
//       error: error.message,
//     });
//   }
// };

// // Confirm payment and create eSIM order
// const confirmPaymentAndCreateEsim = async (req, res) => {
//   try {
//     const { paymentIntentId, paymentMethod } = req.body;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     // First, confirm the payment with Stripe using the payment method details
//     let paymentIntent;
    
//     if (paymentMethod) {
//       console.log("💳 Confirming payment with Stripe...");
      
//       // Confirm the payment intent with the provided payment method
//       paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
//         payment_method: {
//           type: 'card',
//           card: {
//             number: paymentMethod.card.number,
//             exp_month: paymentMethod.card.exp_month,
//             exp_year: paymentMethod.card.exp_year,
//             cvc: paymentMethod.card.cvc,
//           },
//           billing_details: paymentMethod.billing_details,
//         },
//         return_url: 'https://your-website.com/return', // Add your return URL
//       });
//     } else {
//       // Just retrieve the payment intent if no payment method provided
//       paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//     }

//     console.log("Payment Intent Status:", paymentIntent.status);

//     // Check if payment was successful
//     if (paymentIntent.status !== 'succeeded') {
//       // If payment requires additional action (like 3D Secure)
//       if (paymentIntent.status === 'requires_action') {
//         return res.status(200).json({
//           success: false,
//           status: paymentIntent.status,
//           requires_action: true,
//           payment_intent: {
//             id: paymentIntent.id,
//             client_secret: paymentIntent.client_secret,
//             next_action: paymentIntent.next_action,
//           },
//           message: "Payment requires additional authentication",
//         });
//       }

//       // If payment failed or requires payment method
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//         status: paymentIntent.status,
//         last_payment_error: paymentIntent.last_payment_error,
//       });
//     }

//     const { username, bundleName, order_code } = paymentIntent.metadata;

//     console.log("✅ Payment succeeded, creating eSIM order...");
//     console.log("➡️ Username:", username);
//     console.log("➡️ Bundle Name:", bundleName);
//     console.log("➡️ Order Code:", order_code);

//     // Now create the eSIM with the provider
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";

//     const providerPayload = {
//       type: "transaction",
//       assign: true,
//       order: [
//         {
//           type: "bundle",
//           quantity: 1,
//           item: bundleName,
//           iccid: "",
//           allowReassign: false,
//         },
//       ],
//     };

//     // Call eSIM provider
//     const response = await axios.post(BASE_URL, providerPayload, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ Provider Response Status:", response.status);
//     const providerData = response.data;

// // Save order to database
// let savedOrder = null;
// if (providerData.status === "completed") {
//   const newOrder = new Orders({
//     username,
//     order_code,
//     provider_reference_code: providerData.orderReference,
//     order: providerData.order,
//     total: paymentIntent.amount / 100, // Convert from cents
//     currency: paymentIntent.currency,
//     status: providerData.status,
//     statusMessage: providerData.statusMessage,
//     orderReference: providerData.orderReference,
//     createdDate: providerData.createdDate,
//     assigned: providerData.assigned,
//     paymentIntentId: paymentIntentId,
//     paymentStatus: 'completed',
//     customerEmail: paymentIntent.receipt_email || username, // Use username as fallback if it's an email
//     bundleName: bundleName,
//     esimData: {
//       iccid: providerData.order && providerData.order[0] ? providerData.order[0].iccid : '',
//       activationCode: providerData.order && providerData.order[0] ? providerData.order[0].activationCode : '',
//       qrCodeUrl: providerData.order && providerData.order[0] ? providerData.order[0].qrCodeUrl : '',
//     }
//   });

//   savedOrder = await newOrder.save();
//   console.log("💾 Order saved in DB:", savedOrder._id);
  
//   // 📧 Send confirmation email
//   console.log("📧 Sending order confirmation email...");
//   try {
//     const emailResult = await emailService.sendEsimOrderConfirmation(savedOrder);
//     if (emailResult.success) {
//       console.log("✅ Confirmation email sent successfully to:", emailResult.recipient);
//     } else {
//       console.log("⚠️  Failed to send confirmation email:", emailResult.error || emailResult.message);
//     }
//   } catch (emailError) {
//     console.error("❌ Error sending confirmation email:", emailError.message);
//     // Don't fail the entire request if email fails
//   }
// }


//     res.status(201).json({
//       success: true,
//       status: 'succeeded',
//       message: "Payment confirmed and eSIM order created successfully",
//       order_code,
//       provider_reference_code: providerData.orderReference,
//       paymentIntentId,
//       providerResponse: providerData,
//       savedOrder,
//     });
//   } catch (error) {
//     console.error("❌ Error confirming payment and creating eSIM:", error);
    
//     // Handle specific Stripe errors
//     if (error.type === 'StripeCardError') {
//       return res.status(400).json({
//         success: false,
//         message: "Your card was declined",
//         error: error.message,
//         decline_code: error.decline_code,
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: "Failed to confirm payment and create eSIM",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// // Webhook endpoint for Stripe events
// const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.log(`❌ Webhook signature verification failed:`, err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // Handle the event
//   switch (event.type) {
//     case 'payment_intent.succeeded':
//       const paymentIntent = event.data.object;
//       console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: paymentIntent.id },
//           { 
//             paymentStatus: 'completed',
//             status: 'paid',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating order status:', dbError);
//       }
//       break;

//     case 'payment_intent.payment_failed':
//       const failedPayment = event.data.object;
//       console.log('❌ PaymentIntent failed:', failedPayment.id);
      
//       // Update order status in database
//       try {
//         await Orders.findOneAndUpdate(
//           { paymentIntentId: failedPayment.id },
//           { 
//             paymentStatus: 'failed',
//             status: 'payment_failed',
//             updatedAt: new Date()
//           }
//         );
//       } catch (dbError) {
//         console.error('❌ Error updating failed payment status:', dbError);
//       }
//       break;

//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   res.json({ received: true });
// };

// // Get payment status
// const getPaymentStatus = async (req, res) => {
//   try {
//     const { paymentIntentId } = req.params;

//     if (!paymentIntentId) {
//       return res.status(400).json({
//         message: "paymentIntentId is required",
//       });
//     }

//     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//     res.status(200).json({
//       message: "Payment status retrieved successfully",
//       status: paymentIntent.status,
//       amount: paymentIntent.amount / 100,
//       currency: paymentIntent.currency,
//       metadata: paymentIntent.metadata,
//     });
//   } catch (error) {
//     console.error("❌ Error retrieving payment status:", error.message);
//     res.status(500).json({
//       message: "Failed to retrieve payment status",
//       error: error.message,
//     });
//   }
// };

// // Modified getEsimgoCatalogue with commission middleware
// const getEsimgoCatalogue = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
//     const { countryCode } = req.query;
    
//     console.log("🔌 MongoDB Connected: localhost");
//     console.log("🌍 Fetching eSIMGO catalogue...");
//     console.log("➡️ Country Code:", countryCode || "Not Provided");
    
//     let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
//     if (countryCode) {
//       requestUrl += `&countries=${countryCode}`;
//     }
    
//     console.log("➡️ API URL:", requestUrl);
//     console.log("➡️ Using API Key:", API_KEY ? "✅ Loaded" : "❌ Missing");
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const { bundles } = response.data;
    
//     const beautified = bundles.map((bundle) => ({
//       name: bundle.name,
//       provider: "esimgo",
//       description: bundle.description,
//       picture: bundle.imageUrl,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       price: bundle.price,
//       countries: bundle.countries.map((c) => c.name),
//       region: bundle.countries[0]?.region || null,
//       speed: bundle.speed || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//     }));
    
//     // Apply commission middleware
//     console.log("💰 Applying commission rates...");
//     const bundlesWithCommission = applyCommissionMiddleware(beautified, "esimgo");
    
//     console.log("📦 Total Bundles Fetched:", bundlesWithCommission.length);
    
//     res.status(200).json({
//       message: "Catalogue fetched successfully",
//       total: bundlesWithCommission.length,
//       bundles: bundlesWithCommission,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching catalogue");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch catalogue",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// // Modified getSpecificBundle with commission middleware
// const getSpecificBundle = async (req, res) => {
//   try {
    
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/catalogue/bundle";
//     const { name } = req.params;
    
//     if (!name) {
//       return res.status(400).json({
//         message: "Bundle name is required in params (/bundle/:name)",
//       });
//     }
    
//     console.log("🌍 Fetching Specific eSIMGO Bundle...");
//     console.log("➡️ Bundle Name:", name);
    
//     const requestUrl = `${BASE_URL}/${name}`;
//     console.log("➡️ API URL:", requestUrl);
    
//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ API Response Status:", response.status);
//     const bundle = response.data;
    
//     const beautified = {
//       name: bundle.name,
//       description: bundle.description,
//       provider: "esimgo",
//       picture: bundle.imageUrl,
//       price: bundle.price,
//       data_quantity: bundle.dataAmount,
//       duration: bundle.duration,
//       speed: bundle.speed?.speeds || [],
//       autostart: bundle.autostart,
//       unlimited: bundle.unlimited,
//       billingType: bundle.billingType,
//       group: bundle.group || [],
//       countries: bundle.countries.map((c) => ({
//         name: c.country?.name,
//         iso: c.country?.iso,
//         region: c.country?.region,
//         networks: c.networks.map((n) => ({
//           name: n.name,
//           brand: n.brandName,
//           speeds: n.speeds,
//         })),
//       })),
//       allowances: bundle.allowances || [],
//     };
    
//     // Apply commission middleware for single bundle
//     console.log("💰 Applying commission rates to single bundle...");
//     const bundleWithCommission = applySingleBundleCommission(beautified, "esimgo");
    
//     res.status(200).json({
//       message: "Bundle fetched successfully",
//       bundle: bundleWithCommission,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching bundle");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch bundle",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getOrderDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/orders";
//     const { orderId } = req.params;

//     if (!orderId) {
//       return res.status(400).json({
//         message: "Order ID is required in params (/orders/:orderId)",
//       });
//     }

//     console.log("📋 Fetching eSIMGO Order Details...");
//     console.log("➡️ Order ID:", orderId);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(orderId)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const order = response.data;

//     const beautified = {
//       orderId: order.orderId,
//       bundleName: order.bundleName,
//       quantity: order.quantity,
//       status: order.status,
//       totalPrice: order.totalPrice,
//       createdAt: order.createdAt,
//       updatedAt: order.updatedAt,
//       esims: order.esims?.map((esim) => ({
//         iccid: esim.iccid,
//         status: esim.status,
//         activationCode: esim.activationCode,
//         qrCodeUrl: esim.qrCodeUrl,
//       })) || [],
//     };

//     res.status(200).json({
//       message: "Order details fetched successfully",
//       order: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching order details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch order details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// const getEsimDetails = async (req, res) => {
//   try {
//     const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
//     const BASE_URL = "https://api.esim-go.com/v2.5/esims";
//     const { iccid } = req.params;

//     if (!iccid) {
//       return res.status(400).json({
//         message: "ICCID is required in params (/esims/:iccid)",
//       });
//     }

//     console.log("📱 Fetching eSIM Details...");
//     console.log("➡️ ICCID:", iccid);

//     const requestUrl = `${BASE_URL}/${encodeURIComponent(iccid)}`;
//     console.log("➡️ API URL:", requestUrl);

//     const response = await axios.get(requestUrl, {
//       headers: {
//         "X-API-Key": API_KEY,
//         "Content-Type": "application/json",
//       },
//     });

//     console.log("✅ API Response Status:", response.status);
//     const esim = response.data;

//     const beautified = {
//       iccid: esim.iccid,
//       orderId: esim.orderId,
//       bundleName: esim.bundleName,
//       status: esim.status,
//       activationCode: esim.activationCode,
//       qrCodeUrl: esim.qrCodeUrl,
//       createdAt: esim.createdAt,
//       dataUsage: esim.dataUsage || null,
//       startDate: esim.startDate || null,
//       endDate: esim.endDate || null,
//     };

//     res.status(200).json({
//       message: "eSIM details fetched successfully",
//       esim: beautified,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching eSIM details");
//     console.error("➡️ Status:", error.response?.status || "No status");
//     console.error("➡️ Data:", error.response?.data || "No response data");
//     console.error("➡️ Message:", error.message);
    
//     res.status(500).json({
//       message: "Failed to fetch eSIM details",
//       error: error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

// module.exports = {
//   getEsimgoCatalogue,
//   getSpecificBundle,
//   createPaymentIntent,
//   confirmPaymentAndCreateEsim,
//   handleStripeWebhook,
//   getPaymentStatus,
//   getOrderDetails,
//   getEsimDetails,
//   // Export middleware functions for potential reuse
//   applyCommissionMiddleware,
//   applySingleBundleCommission,
//   COMMISSION_RATES
// };

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");
const Orders = require("../models/Order");
const redis = require("../config/redis");
const crypto = require('crypto');
// Add this import at the top of your controller file
const emailService = require('../services/EmailServices');
// Cache TTL in seconds (e.g., 1 hour)
const CACHE_TTL = 86400;
// Country-specific custom pricing configuration
// Add your custom prices for each country and plan type here
// Country-specific custom pricing configuration - Will be fetched from API
let COUNTRY_PRICING = [];

// Default pricing fallback if country not found
// Default pricing fallback if country not found
const DEFAULT_PRICING = {};


// Function to fetch country pricing from API
const fetchCountryPricingFromAPI = async () => {
  try {
    console.log("🌍 Fetching country pricing from API...");
    const response = await axios.get('https://api.soraroam.com/api/plans/esimgo', {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      COUNTRY_PRICING = response.data;
      console.log(`✅ Successfully fetched ${COUNTRY_PRICING.length} country pricing records from API`);
      
      // Cache the pricing data in Redis
      if (redis) {
        await redis.setex('country_pricing', CACHE_TTL, JSON.stringify(COUNTRY_PRICING));
        console.log("✅ Country pricing cached in Redis");
      }
      
      return COUNTRY_PRICING;
    } else {
      console.warn("⚠️ API returned unexpected data format");
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching country pricing from API:", error.message);
    
    // Try to get cached data from Redis as fallback
    if (redis) {
      try {
        const cachedPricing = await redis.get('country_pricing');
        if (cachedPricing) {
          COUNTRY_PRICING = JSON.parse(cachedPricing);
          console.log(`✅ Loaded ${COUNTRY_PRICING.length} country pricing records from Redis cache`);
          return COUNTRY_PRICING;
        }
      } catch (cacheError) {
        console.error("❌ Error reading from Redis cache:", cacheError.message);
      }
    }
    
    return [];
  }
};

// Initialize country pricing on startup
const initializeCountryPricing = async () => {
  await fetchCountryPricingFromAPI();
  
  // Refresh pricing every hour
  setInterval(fetchCountryPricingFromAPI, 60 * 60 * 1000);
};

// Call initialization (you might want to call this when your server starts)
// initializeCountryPricing();

// Helper function to find pricing for a specific country

const REGIONAL_PRICING = [
{
"region": "Africa",
"7days_1gb": 10.35,
"15days_2gb": 19.88,
"30days_3gb": 27.78,
"30days_5gb": 36.6,
"30days_10gb": 67.09,
"30days_20gb": 115.43,
"30days_50gb": null,
"30days_100gb": null,
"1_day_unlimited": 17.31,
"3_day_unlimited": 49.98,
"5_day_unlimited": 82.65,
"7_day_unlimited": 92.26,
"10_day_unlimited": 131.47,
"15_day_unlimited": null,
"30_day_unlimited": null
},
{
"region": "LATAM",
"7days_1gb": 5.1,
"15days_2gb": 9.39,
"30days_3gb": 12.95,
"30days_5gb": 16.81,
"30days_10gb": 30.53,
"30days_20gb": 52.24,
"30days_50gb": 117.93,
"30days_100gb": null,
"1_day_unlimited": 8.34,
"3_day_unlimited": 23.03,
"5_day_unlimited": 37.71,
"7_day_unlimited": 41.92,
"10_day_unlimited": 59.54,
"15_day_unlimited": 85.21,
"30_day_unlimited": 169.67
},
{
"region": "Asia",
"7days_1gb": 4.44,
"15days_2gb": 8.07,
"30days_3gb": 11.07,
"30days_5gb": 14.32,
"30days_10gb": 25.91,
"30days_20gb": 44.28,
"30days_50gb": 99.82,
"30days_100gb": 194.65,
"1_day_unlimited": 7.2,
"3_day_unlimited": 19.62,
"5_day_unlimited": 32.04,
"7_day_unlimited": 35.57,
"10_day_unlimited": 50.47,
"15_day_unlimited": 72.17,
"30_day_unlimited": 143.59
},
{
"region": "Balkans",
"7days_1gb": 12.54,
"15days_2gb": 23.36,
"30days_3gb": 32.84,
"30days_5gb": 40.87,
"30days_10gb": 65.21,
"30days_20gb": 103.97,
"30days_50gb": 233.58,
"30days_100gb": null,
"1_day_unlimited": 16.67,
"3_day_unlimited": 49.14,
"5_day_unlimited": 81.6,
"7_day_unlimited": 91.24,
"10_day_unlimited": 130.19,
"15_day_unlimited": 186.98,
"30_day_unlimited": null
},
{
"region": "Europe Lite",
"7days_1gb": 2.39,
"15days_2gb": 3.95,
"30days_3gb": 5.24,
"30days_5gb": 6.54,
"30days_10gb": 11.53,
"30days_20gb": 19.41,
"30days_50gb": 43.32,
"30days_100gb": 84.48,
"1_day_unlimited": 3.36,
"3_day_unlimited": 7.65,
"5_day_unlimited": 12.42,
"7_day_unlimited": 13.61,
"10_day_unlimited": 19.37,
"15_day_unlimited": 27.19,
"30_day_unlimited": 53.13
},
{
"region": "Middle East",
"7days_1gb": 5.87,
"15days_2gb": 10.91,
"30days_3gb": 15.08,
"30days_5gb": 19.67,
"30days_10gb": 35.8,
"30days_20gb": 61.35,
"30days_50gb": 138.63,
"30days_100gb": null,
"1_day_unlimited": 9.63,
"3_day_unlimited": 26.91,
"5_day_unlimited": 44.19,
"7_day_unlimited": 49.18,
"10_day_unlimited": 69.91,
"15_day_unlimited": 100.12,
"30_day_unlimited": 199.48
},
{
"region": "North America",
"7days_1gb": 3.9,
"15days_2gb": 7.05,
"30days_3gb": 10.05,
"30days_5gb": 12.9,
"30days_10gb": 23.4,
"30days_20gb": 39.1,
"30days_50gb": 85.1,
"30days_100gb": 165.95,
"1_day_unlimited": 7.05,
"3_day_unlimited": 18.96,
"5_day_unlimited": 30.96,
"7_day_unlimited": 34.34,
"10_day_unlimited": 48.67,
"15_day_unlimited": 69.69,
"30_day_unlimited": 137.99
},
{
"region": "Oceania",
"7days_1gb": 4.44,
"15days_2gb": 8.07,
"30days_3gb": 11.07,
"30days_5gb": 14.32,
"30days_10gb": 25.91,
"30days_20gb": 44.28,
"30days_50gb": 99.82,
"30days_100gb": 194.65,
"1_day_unlimited": 7.2,
"3_day_unlimited": 19.62,
"5_day_unlimited": 32.04,
"7_day_unlimited": 35.57,
"10_day_unlimited": 50.47,
"15_day_unlimited": 72.17,
"30_day_unlimited": 143.59
},
{
"region": "Caribbean",
"7days_1gb": 9.81,
"15days_2gb": 17.45,
"30days_3gb": 24.59,
"30days_5gb": 28.44,
"30days_10gb": 49.19,
"30days_20gb": 79.34,
"30days_50gb": null,
"30days_100gb": null,
"1_day_unlimited": 17.13,
"3_day_unlimited": 49.67,
"5_day_unlimited": 82.47,
"7_day_unlimited": 92.23,
"10_day_unlimited": 131.6,
"15_day_unlimited": 189.01,
"30_day_unlimited": null
},
{
"region": "Global",
"7days_1gb": 12.09,
"15days_2gb": 23.34,
"30days_3gb": 32.67,
"30days_5gb": 43.13,
"30days_10gb": 79.16,
"30days_20gb": 136.3,
"30days_50gb": null,
"30days_100gb": null,
"1_day_unlimited": 20.28,
"3_day_unlimited": 58.89,
"5_day_unlimited": 97.5,
"7_day_unlimited": 108.89,
"10_day_unlimited": 155.23,
"15_day_unlimited": null,
"30_day_unlimited": null
}
];
// Default regional pricing fallback if region not found
const DEFAULT_REGIONAL_PRICING = {
  "7days_1gb": 3.99,
  "15days_2gb": 5.99,
  "30days_3gb": 7.99,
  "30days_5gb": 11.99,
  "30days_10gb": 17.99,
  "30days_20gb": 31.99,
  "30days_50gb": 64.99,
  "30days_100gb": 109.99,
  "unlimited": 179.99
};


// Generate a random alphanumeric string of 10 characters
function generateOrderCode(length = 10) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
}

// Helper function to categorize bundle based on data amount and duration
function categorizeBundleType(bundle) {
  const dataAmount = bundle.data_quantity > 0 ? bundle.data_quantity / 1000 : -1;

  const duration = parseInt(bundle.duration) || 0;
  const isUnlimited = bundle.unlimited || false;

if (isUnlimited && duration <= 1) {
    return "1_day_unlimited";
  } else if (duration === 3 && isUnlimited === true) {
    return '3_day_unlimited';
  } else if (duration === 5 && isUnlimited === true) {
    return '5_day_unlimited';
  } else if (duration === 7 && isUnlimited === true) {
    return '7_day_unlimited'; 
  } else if (duration === 10 && isUnlimited === true) {
    return '10_day_unlimited'; 
  } else if (duration === 15 && isUnlimited === true) {
    return '15_day_unlimited';
  } else if (duration === 30 && isUnlimited === true) {
    return '30_day_unlimited';
  }

  // Categorize based on duration and data amount (existing logic)
  if (duration <= 7 && dataAmount <= 1) {
    return '7days_1gb';
  } else if (duration <= 15 && dataAmount <= 2) {
    return '15days_2gb';
  } else if (duration <= 30 && dataAmount <= 3) {
    return '30days_3gb';
  } else if (duration <= 30 && dataAmount <= 5) {
    return '30days_5gb';
  } else if (duration <= 30 && dataAmount <= 10) {
    return '30days_10gb';
  } else if (duration <= 30 && dataAmount <= 20) {
    return '30days_20gb';
  } else if (duration <= 30 && dataAmount <= 50) {
    return '30days_50gb';
  } else if (duration <= 30 && dataAmount <= 100) {
    return '30days_100gb';
  }

  // Default to highest category if doesn't match
  return '30days_100gb';
}

// Helper function to get country name from bundle
function getCountryName(bundle) {
  if (!bundle.countries || !bundle.countries.length) {
    return null;
  }

  const c = bundle.countries[0];

  // Case 1: Standard esimgo format
  if (c.country && typeof c.country === "object" && c.country.name) {
    return c.country.name;  // ✅ Spain
  }

  // Case 2: c.country is a string
  if (typeof c.country === "string") {
    return c.country;
  }

  // Case 3: fallback if the API gives { name: "Spain" }
  if (c.name) {
    return c.name;
  }

  // Case 4: array contains just a string
  if (typeof c === "string") {
    return c;
  }

  return null;
}

// Helper function to find pricing for a specific country
const findCountryPricing = (countryName) => {
  if (!countryName) return DEFAULT_PRICING;

  const countryPricing = COUNTRY_PRICING.find(
    pricing => pricing.country.toLowerCase().trim() === countryName.toLowerCase().trim()
  );

  return countryPricing || DEFAULT_PRICING;
};

const getRegionName = (bundle) => {
  if (!bundle) return "unknown";

  // First: Try direct region from countries array
  if (bundle.countries && bundle.countries.length > 0) {
    if (bundle.countries[0].country && bundle.countries[0].country.region) {
      return bundle.countries[0].country.region;
    }
  }

  // Second: Try roamingCountries
  if (bundle.roamingEnabled && bundle.roamingEnabled.length > 0) {
    if (bundle.roamingEnabled[0].country && bundle.roamingEnabled[0].country.region) {
      return bundle.roamingEnabled[0].country.region;
    }
  }

  // Third: Fallback → look in description/name
  if (bundle.description) {
    const regions = REGIONAL_PRICING.map(r => r.region.toLowerCase());
    const match = regions.find(r => bundle.description.toLowerCase().includes(r));
    if (match) return match[0].toUpperCase() + match.slice(1);
  }

  if (bundle.name) {
    const regions = REGIONAL_PRICING.map(r => r.region.toLowerCase());
    const match = regions.find(r => bundle.name.toLowerCase().includes(r));
    if (match) return match[0].toUpperCase() + match.slice(1);
  }

  return "unknown";
};

// Helper function to find pricing for a specific region
const findRegionalPricing = (regionName) => {
  if (!regionName) return DEFAULT_REGIONAL_PRICING;

  const regionPricing = REGIONAL_PRICING.find(
    r => r.region.toLowerCase() === regionName.toLowerCase()
  );

  return regionPricing || DEFAULT_REGIONAL_PRICING;
};

// Regional-based Custom Pricing Middleware
const applyRegionalPricingMiddleware = (bundles, provider = 'esimgo') => {
  if (provider !== 'esimgo') {
    return bundles; // No custom pricing for other providers
  }

  return bundles.map(bundle => {
    try {
      const regionName = getRegionName(bundle);
      const bundleType = categorizeBundleType(bundle);
      const regionalPricing = findRegionalPricing(regionName);

      // Ensure custom price is 2 decimals
      const customPrice = Number((regionalPricing[bundleType] || DEFAULT_REGIONAL_PRICING[bundleType] || 9.99).toFixed(2));
      const originalPrice = Number(parseFloat(bundle.price || 0).toFixed(2));
      const markup = Number((customPrice - originalPrice).toFixed(2));
      const markupPercentage = originalPrice > 0 ? Number(((markup / originalPrice) * 100).toFixed(2)) : 0;

      console.log(`🌍 Regional Pricing Applied - Bundle: ${bundle.name}`);
      console.log(`➡️ Region: ${regionName || 'Unknown'}, Plan Type: ${bundleType}`);
      console.log(`➡️ Original Price: $${originalPrice} → Custom Price: $${customPrice}`);
      console.log(`➡️ Markup: $${markup} (${markupPercentage}%)`);

      return {
        ...bundle,
        originalPrice,
        price: customPrice,
        regionalPricingInfo: {
          region: regionName,
          bundleType,
          originalPrice,
          customPrice,
          markup,
          markupPercentage,
          pricingSource: regionalPricing === DEFAULT_REGIONAL_PRICING ? 'default' : 'region-specific'
        }
      };
    } catch (error) {
      console.error(`❌ Error applying regional pricing to bundle ${bundle.name}:`, error);
      return bundle;
    }
  });
};
// Get specific regional bundle with regional pricing
// Helper function to normalize bundle data structure for both API formats
const normalizeBundleData = (bundle) => {
  // Handle countries array - support both old and new formats
  let countries = [];
  if (bundle.countries && bundle.countries.length > 0) {
    countries = bundle.countries.map((c) => {
      // New format with nested country object
      if (c.country && c.country.name) {
        return {
          name: c.country.name,
          iso: c.country.iso,
          region: c.country.region,
          networks: (c.networks || []).map((n) => ({
            name: n.name,
            brand: n.brandName,
            speeds: n.speeds || [],
          })),
        };
      }
      // Old format with direct properties
      else if (c.name) {
        return {
          name: c.name,
          iso: c.iso,
          region: c.region,
          networks: (c.networks || []).map((n) => ({
            name: n.name,
            brand: n.brandName,
            speeds: n.speeds || [],
          })),
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Handle roaming enabled countries (additional coverage for regional bundles)
  let roamingCountries = [];
  if (bundle.roamingEnabled && bundle.roamingEnabled.length > 0) {
    roamingCountries = bundle.roamingEnabled.map((c) => ({
      name: c.country?.name,
      iso: c.country?.iso,
      region: c.country?.region,
      networks: (c.networks || []).map((n) => ({
        name: n.name,
        brand: n.brandName,
        speeds: n.speeds || [],
      })),
    }));
  }

  return {
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
    countries: countries,
    roamingCountries: roamingCountries, // Additional countries for regional bundles
    allowances: bundle.allowances || [],
    region: bundle.description || bundle.name || countries[0]?.region || null,
  };
};
const getSpecificRegionalBundle = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/catalogue/bundle";
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        message: "Bundle name is required in params (/regional-bundle/:name)",
      });
    }
    
    console.log("🌍 Fetching Specific Regional eSIMGO Bundle...");
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
    
    // Normalize bundle data to handle both API formats
    const beautified = normalizeBundleData(bundle);
    
    // Apply regional pricing middleware for single bundle
    console.log("🌍 Applying regional pricing to bundle...");
    const bundleWithRegionalPricing = applySingleBundleRegionalPricing(beautified, "esimgo");
    
    res.status(200).json({
      message: "Regional bundle fetched successfully",
      bundle: bundleWithRegionalPricing,
    });
  } catch (error) {
    console.error("❌ Error fetching regional bundle");
    console.error("➡️ Status:", error.response?.status || "No status");
    console.error("➡️ Data:", error.response?.data || "No response data");
    console.error("➡️ Message:", error.message);
    
    res.status(500).json({
      message: "Failed to fetch regional bundle",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

const applySingleBundleRegionalPricing = (bundle, provider = "esimgo") => {
  if (provider !== "esimgo") return bundle;

  try {
    const regionName = getRegionName(bundle);
    const bundleType = categorizeBundleType(bundle);
    const regionalPricing = findRegionalPricing(regionName);

    // ✅ Always trust API for original price
    const originalPrice = parseFloat(bundle.price) || 0;

    // ✅ Only override final price if regional pricing exists
    const hasCustomPrice =
      regionalPricing &&
      regionalPricing[bundleType] &&
      regionalPricing[bundleType] > 0;

    const customPrice = hasCustomPrice
      ? regionalPricing[bundleType]
      : originalPrice;

    const markup = customPrice - originalPrice;
    const markupPercentage =
      originalPrice > 0
        ? ((markup / originalPrice) * 100).toFixed(2)
        : 0;

    console.log(`🌍 Applied Regional Pricing - ${bundle.name}`);
    console.log(
      `➡️ Region: ${regionName}, Plan Type: ${bundleType}`
    );
    console.log(
      `➡️ Original (API): $${originalPrice} → Custom (Regional): $${customPrice}`
    );

    return {
      ...bundle,
      originalPrice, // always API value
      price: customPrice, // final applied price
      regionalPricingInfo: {
        region: regionName,
        bundleType,
        originalPrice,
        customPrice,
        markup,
        markupPercentage: parseFloat(markupPercentage),
        pricingSource: hasCustomPrice ? "region-specific" : "api-default",
      },
    };
  } catch (error) {
    console.error(
      `❌ Error applying regional pricing to bundle "${bundle?.name}"`,
      error
    );
    return bundle;
  }
};

// Helper function to update pricing for a specific region and plan type
const updateRegionalPricing = (regionName, planType, newPrice) => {
  const regionIndex = REGIONAL_PRICING.findIndex(
    pricing => pricing.region.toLowerCase() === regionName.toLowerCase()
  );
  
  if (regionIndex !== -1) {
    // Update existing region pricing
    const oldPrice = REGIONAL_PRICING[regionIndex][planType];
    REGIONAL_PRICING[regionIndex][planType] = newPrice;
    console.log(`🌍 Updated pricing for ${regionName} - ${planType}: $${oldPrice} → $${newPrice}`);
    return true;
  } else {
    console.error(`❌ Region "${regionName}" not found in pricing configuration`);
    return false;
  }
};

// Helper function to add new region pricing
const addRegionalPricing = (regionName, pricingObject) => {
  const existingIndex = REGIONAL_PRICING.findIndex(
    pricing => pricing.region.toLowerCase() === regionName.toLowerCase()
  );
  
  if (existingIndex !== -1) {
    console.log(`⚠️ Region "${regionName}" already exists. Use updateRegionalPricing to modify existing pricing.`);
    return false;
  }
  
  REGIONAL_PRICING.push({
    region: regionName.toLowerCase(),
    ...pricingObject
  });
  
  console.log(`✅ Added new regional pricing for: ${regionName}`);
  return true;
};

// Function to get current pricing for all regions
const getAllRegionalPricing = () => {
  return [...REGIONAL_PRICING];
};

// Function to get pricing for a specific region
const getRegionalPricing = (regionName) => {
  return findRegionalPricing(regionName);
};

const applyCountryPricingMiddleware = (bundles, provider = 'esimgo') => {
  if (provider !== 'esimgo') {
    return bundles;
  }

  return bundles.map(bundle => {
    try {
      const countryName = getCountryName(bundle);
      const bundleType = categorizeBundleType(bundle);
      const countryPricing = findCountryPricing(countryName);
      
      // Check if this country has pricing data and specifically has this bundle type
      const hasCountryPricing = countryPricing && countryPricing !== DEFAULT_PRICING;
      const hasSpecificPlan = hasCountryPricing && countryPricing.hasOwnProperty(bundleType) && countryPricing[bundleType] !== null;
      
      // If country exists in pricing but doesn't have this specific plan, return null to exclude it
      if (hasCountryPricing && !hasSpecificPlan) {
        console.log(`🚫 Excluding bundle: ${bundle.name} - Country ${countryName} has no ${bundleType} plan`);
        return null;
      }
      
      // Only apply pricing if country has this specific plan - ensure 2 decimal places
      const customPrice = Number((hasSpecificPlan
        ? countryPricing[bundleType]
        : (DEFAULT_PRICING[bundleType] || 9.99)
      ).toFixed(2));
      
      const originalPrice = Number((parseFloat(bundle.price) || 0).toFixed(2));
      const markup = Number((customPrice - originalPrice).toFixed(2));
      const markupPercentage = originalPrice > 0 ? Number(((markup / originalPrice) * 100).toFixed(2)) : 0;

      return {
        ...bundle,
        originalPrice: originalPrice,
        price: customPrice,
        pricingInfo: {
          country: countryName,
          bundleType: bundleType,
          originalPrice: originalPrice,
          customPrice: customPrice,
          markup: markup,
          markupPercentage: markupPercentage,
          pricingSource: hasSpecificPlan ? 'country-specific' : 'default'
        }
      };
    } catch (error) {
      console.error(`❌ Error applying country pricing to bundle ${bundle.name}:`, error);
      return bundle;
    }
  }).filter(bundle => bundle !== null); // Remove excluded bundles
};

const applySingleBundleCountryPricing = (bundle, provider = 'esimgo') => {
  if (provider !== 'esimgo') {
    return bundle;
  }

  try {
    const countryName = getCountryName(bundle);
    const bundleType = categorizeBundleType(bundle);
    const countryPricing = findCountryPricing(countryName);
    
    // Check if this country has pricing data and specifically has this bundle type
    const hasCountryPricing = countryPricing && countryPricing !== DEFAULT_PRICING;
    const hasSpecificPlan = hasCountryPricing && countryPricing.hasOwnProperty(bundleType) && countryPricing[bundleType] !== null;
    
    // If country exists in pricing but doesn't have this specific plan, return null (will be filtered out)
    if (hasCountryPricing && !hasSpecificPlan) {
      console.log(`🚫 Excluding bundle: ${bundle.name} - Country ${countryName} has no ${bundleType} plan`);
      return null;
    }
    
    // Ensure 2 decimal places for all prices
    const customPrice = Number((hasSpecificPlan
      ? countryPricing[bundleType]
      : (DEFAULT_PRICING[bundleType] || 9.99)
    ).toFixed(2));
    
    const originalPrice = Number((parseFloat(bundle.price) || 0).toFixed(2));
    const markup = Number((customPrice - originalPrice).toFixed(2));
    const markupPercentage = originalPrice > 0 ? Number(((markup / originalPrice) * 100).toFixed(2)) : 0;
    
    console.log(`💰 Single Bundle Country Pricing Applied - ${bundle.name}`);
    console.log(`➡️ Country: ${countryName || 'Unknown'}, Plan Type: ${bundleType}`);
    console.log(`➡️ Original Price: $${originalPrice} → Custom Price: $${customPrice}`);
    console.log(`➡️ Markup: $${markup} (${markupPercentage}%)`);

    return {
      ...bundle,
      originalPrice: originalPrice,
      price: customPrice,
      pricingInfo: {
        country: countryName,
        bundleType: bundleType,
        originalPrice: originalPrice,
        customPrice: customPrice,
        markup: markup,
        markupPercentage: markupPercentage,
        pricingSource: hasSpecificPlan ? 'country-specific' : 'default'
      }
    };
  } catch (error) {
    console.error(`❌ Error applying country pricing to single bundle ${bundle.name}:`, error);
    return bundle;
  }
};
// Helper function to update pricing for a specific country and plan type
const updateCountryPricing = (countryName, planType, newPrice) => {
  const countryIndex = COUNTRY_PRICING.findIndex(
    pricing => pricing.country.toLowerCase() === countryName.toLowerCase()
  );
  
  if (countryIndex !== -1) {
    // Update existing country pricing
    const oldPrice = COUNTRY_PRICING[countryIndex][planType];
    COUNTRY_PRICING[countryIndex][planType] = newPrice;
    console.log(`💰 Updated pricing for ${countryName} - ${planType}: $${oldPrice} → $${newPrice}`);
    return true;
  } else {
    console.error(`❌ Country "${countryName}" not found in pricing configuration`);
    return false;
  }
};

// Helper function to add new country pricing
const addCountryPricing = (countryName, pricingObject) => {
  const existingIndex = COUNTRY_PRICING.findIndex(
    pricing => pricing.country.toLowerCase() === countryName.toLowerCase()
  );
  
  if (existingIndex !== -1) {
    console.log(`⚠️ Country "${countryName}" already exists. Use updateCountryPricing to modify existing pricing.`);
    return false;
  }
  
  COUNTRY_PRICING.push({
    country: countryName.toLowerCase(),
    ...pricingObject
  });
  
  console.log(`✅ Added new country pricing for: ${countryName}`);
  return true;
};

// Function to get current pricing for all countries
const getAllCountryPricing = () => {
  return [...COUNTRY_PRICING];
};

// Function to get pricing for a specific country
const getCountryPricing = (countryName) => {
  return findCountryPricing(countryName);
};

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
    const { paymentIntentId, paymentMethod, alternate_provider, bun_id, data, duration, country } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "paymentIntentId is required" });
    }

    // ✅ Confirm payment with Stripe
    let paymentIntent;

    if (paymentMethod) {
      console.log("💳 Confirming payment with Stripe...");
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: {
          type: "card",
          card: {
            number: paymentMethod.card.number,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            cvc: paymentMethod.card.cvc,
          },
          billing_details: paymentMethod.billing_details,
        },
        return_url: "https://your-website.com/return",
      });
    } else {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    }

    console.log("Payment Intent Status:", paymentIntent.status);

    // ✅ Check payment success
    if (paymentIntent.status !== "succeeded") {
      if (paymentIntent.status === "requires_action") {
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

    let providerData;
    let savedOrder = null;

    if (alternate_provider) {
      // ✅ Alternate Provider API (Soraroam example)
      console.log("🌍 Using Alternate Provider API...");

      const altPayload = {
        refill_mb: 100,
        refill_days: 1,
        bundle_id: parseInt(bun_id),
        filters: {
          country_code: country, // Replace or derive dynamically if needed
          type: "travel",
          preference: "fastest",
        },
        count: 1,
      };

      const altResponse = await axios.post("https://myaccount.keepgo.com/api/v2/line/create", altPayload, {
        headers: { "Content-Type": "application/json", "apiKey": "39417e7623d65cc293003cfe425bacc0", "accessToken": "d6UaypRMqVe55/dtFdfgQP+Nvy4=" },
      });

      if (altResponse.data.ack !== "success") {
        throw new Error("Alternate provider eSIM creation failed");
      }

      const sim = altResponse.data.sim_card;
      providerData = altResponse.data;
      console.log(providerData);
      const newOrder = new Orders({
        username,
        order_code,
        provider_reference_code: providerData.data_bundle_id,
        order: providerData,
        total: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: "completed",
        statusMessage: "Alternate provider eSIM created successfully",
        orderReference: providerData.data_bundle_id,
        paymentIntentId,
        paymentStatus: "completed",
        customerEmail: paymentIntent.receipt_email || username,
        bundleName,
        esimData: {
          iccid: sim.iccid,
          activationCode: sim.lpa_code,
          qrCodeUrl: "", // Alternate API does not return QR URL
        },
      });

      savedOrder = await newOrder.save();
      console.log("💾 Alternate provider order saved:", savedOrder._id);

    } else {
      // ✅ Default eSIM-Go API
      console.log("🌐 Using eSIM-Go API...");

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

      const response = await axios.post(BASE_URL, providerPayload, {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json",
        },
      });

      providerData = response.data;

      if (providerData.status === "completed") {
        const newOrder = new Orders({
          username,
          order_code,
          provider_reference_code: providerData.orderReference,
          order: providerData.order,
          total: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: providerData.status,
          statusMessage: providerData.statusMessage,
          orderReference: providerData.orderReference,
          createdDate: providerData.createdDate,
          assigned: providerData.assigned,
          paymentIntentId,
          paymentStatus: "completed",
          customerEmail: paymentIntent.receipt_email || username,
          bundleName,
          esimData: {
            iccid: providerData.order?.[0]?.iccid || "",
            activationCode: providerData.order?.[0]?.activationCode || "",
            qrCodeUrl: providerData.order?.[0]?.qrCodeUrl || "",
          },
        });

        savedOrder = await newOrder.save();
        console.log("💾 eSIM-Go order saved:", savedOrder._id);
      }
    }

    // 📧 Send confirmation email
    try {
      const emailResult = await emailService.sendEsimOrderConfirmation(savedOrder);
      if (emailResult.success) {
        console.log("✅ Confirmation email sent:", emailResult.recipient);
      } else {
        console.log("⚠️ Email send failed:", emailResult.error || emailResult.message);
      }
    } catch (emailError) {
      console.error("❌ Error sending email:", emailError.message);
    }

    res.status(201).json({
      success: true,
      status: "succeeded",
      message: "Payment confirmed and eSIM order created successfully",
      order_code,
      provider_reference_code:
        providerData.orderReference || providerData.data_bundle_id,
      paymentIntentId,
      providerResponse: providerData,
      savedOrder,
    });
  } catch (error) {
    console.error("❌ Error confirming payment and creating eSIM:", error);

    if (error.type === "StripeCardError") {
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
// Helper function to determine if a bundle is regional
function isRegionalBundle(bundle) {
  const regionalKeywords = [
    'europe', 'asia', 'africa', 'americas', 'oceania', 'middle east',
    'north america', 'south america', 'latin america', 'caribbean',
    'balkans', 'global', 'worldwide'
  ];
  
  const bundleName = (bundle.name || '').toLowerCase();
  const bundleDescription = (bundle.description || '').toLowerCase();
  
  return regionalKeywords.some(keyword => 
    bundleName.includes(keyword) || bundleDescription.includes(keyword)
  );
}

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
// ✅ Whitelisted plans that we officially offer
const allowedPlans = new Set([
  "7days_1gb",
  "15days_2gb",
  "30days_3gb",
  "30days_5gb",
  "30days_10gb",
  "30days_20gb",
  "30days_50gb",
  "30days_100gb",
  "1_day_unlimited",
  "3_day_unlimited",
  "5_day_unlimited",
  "7_day_unlimited",
  "10_day_unlimited",
  "15_day_unlimited",
  "30_day_unlimited"
]);

// ✅ Country-specific catalogue function
const getEsimgoCatalogue = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
    const { countryCode } = req.query;

    const cacheKey = `esimgo_catalogue_${countryCode ? countryCode.toUpperCase() : 'all'}`;

    // Check Redis cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("🌍 Cache hit for eSIMGO catalogue");
      const finalBundles = JSON.parse(cachedData);
      return res.status(200).json({
        message: "Catalogue fetched successfully",
        total: finalBundles.length,
        bundles: finalBundles,
      });
    }

    console.log("🌍 Fetching eSIMGO catalogue...");
    let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
    if (countryCode) {
      requestUrl += `&countries=${countryCode}`;
    }

    const response = await axios.get(requestUrl, {
      headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    });

    const { bundles } = response.data;

    // ✅ Beautify API response
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

    // 💰 Apply country pricing
    let bundlesWithCountryPricing = applyCountryPricingMiddleware(beautified, "esimgo");

    // ✅ Remove duplicates by "name"
    const seen = new Set();
    bundlesWithCountryPricing = bundlesWithCountryPricing.filter(bundle => {
      if (seen.has(bundle.name)) return false;
      seen.add(bundle.name);
      return true;
    });

    // ✅ Handle UL-family bundles
    const ulFamily = bundlesWithCountryPricing.filter(bundle => {
      const lowerName = bundle.name.toLowerCase();
      return (
        lowerName.includes("ul") ||
        lowerName.includes("ulp") ||
        lowerName.includes("ule")
      ) && bundle.duration <= 31; // only keep <= 31 days
    });

    // ✅ From UL-family, keep only ULE
    const uleOnly = ulFamily.filter(bundle =>
      bundle.name.toLowerCase().includes("ule") 
    );

    // ✅ Keep all non-UL-family bundles
    const nonUlFamily = bundlesWithCountryPricing.filter(bundle => {
      const lowerName = bundle.name.toLowerCase();
      return !(lowerName.includes("ul") || lowerName.includes("ulp") || lowerName.includes("ule"));
    });

    // ✅ Combine UL filtering result
    const ulFiltered = [...nonUlFamily, ...uleOnly];

    // ✅ Categorize bundles
    const categorized = ulFiltered.map(bundle => {
      const bundleType = categorizeBundleType(bundle);
      return { ...bundle, bundleType };
    });

    // ✅ Keep only allowed plans
    let finalBundles = categorized.filter(bundle => allowedPlans.has(bundle.bundleType));

    // DEBUG: Log what we're working with
    console.log("🔍 DEBUG - countryCode received:", countryCode);
    console.log("🔍 DEBUG - finalBundles before country filter:", finalBundles.length);

    // ✅ Country-specific dynamic filtering
    if (countryCode) {
      // 🌍 Map of all countries (ISO Alpha-2 -> Country Name)
      const countryCodeMap = {
        "AF": "Afghanistan",
        "AX": "Åland Islands",
        "AL": "Albania",
        "DZ": "Algeria",
        "AS": "American Samoa",
        "AD": "Andorra",
        "AO": "Angola",
        "AI": "Anguilla",
        "AQ": "Antarctica",
        "AG": "Antigua and Barbuda",
        "AR": "Argentina",
        "AM": "Armenia",
        "AW": "Aruba",
        "AU": "Australia",
        "AT": "Austria",
        "AZ": "Azerbaijan",
        "BS": "Bahamas",
        "BH": "Bahrain",
        "BD": "Bangladesh",
        "BB": "Barbados",
        "BY": "Belarus",
        "BE": "Belgium",
        "BZ": "Belize",
        "BJ": "Benin",
        "BM": "Bermuda",
        "BT": "Bhutan",
        "BO": "Bolivia",
        "BQ": "Bonaire, Sint Eustatius and Saba",
        "BA": "Bosnia and Herzegovina",
        "BW": "Botswana",
        "BV": "Bouvet Island",
        "BR": "Brazil",
        "IO": "British Indian Ocean Territory",
        "BN": "Brunei Darussalam",
        "BG": "Bulgaria",
        "BF": "Burkina Faso",
        "BI": "Burundi",
        "CV": "Cabo Verde",
        "KH": "Cambodia",
        "CM": "Cameroon",
        "CA": "Canada",
        "KY": "Cayman Islands",
        "CF": "Central African Republic",
        "TD": "Chad",
        "CL": "Chile",
        "CN": "China",
        "CX": "Christmas Island",
        "CC": "Cocos (Keeling) Islands",
        "CO": "Colombia",
        "KM": "Comoros",
        "CG": "Congo",
        "CD": "Congo, Democratic Republic of the",
        "CK": "Cook Islands",
        "CR": "Costa Rica",
        "CI": "Côte d'Ivoire",
        "HR": "Croatia",
        "CU": "Cuba",
        "CW": "Curaçao",
        "CY": "Cyprus",
        "CZ": "Czechia",
        "DK": "Denmark",
        "DJ": "Djibouti",
        "DM": "Dominica",
        "DO": "Dominican Republic",
        "EC": "Ecuador",
        "EG": "Egypt",
        "SV": "El Salvador",
        "GQ": "Equatorial Guinea",
        "ER": "Eritrea",
        "EE": "Estonia",
        "SZ": "Eswatini",
        "ET": "Ethiopia",
        "FK": "Falkland Islands (Malvinas)",
        "FO": "Faroe Islands",
        "FJ": "Fiji",
        "FI": "Finland",
        "FR": "France",
        "GF": "French Guiana",
        "PF": "French Polynesia",
        "TF": "French Southern Territories",
        "GA": "Gabon",
        "GM": "Gambia",
        "GE": "Georgia",
        "DE": "Germany",
        "GH": "Ghana",
        "GI": "Gibraltar",
        "GR": "Greece",
        "GL": "Greenland",
        "GD": "Grenada",
        "GP": "Guadeloupe",
        "GU": "Guam",
        "GT": "Guatemala",
        "GG": "Guernsey",
        "GN": "Guinea",
        "GW": "Guinea-Bissau",
        "GY": "Guyana",
        "HT": "Haiti",
        "HM": "Heard Island and McDonald Islands",
        "VA": "Holy See",
        "HN": "Honduras",
        "HK": "Hong Kong",
        "HU": "Hungary",
        "IS": "Iceland",
        "IN": "India",
        "ID": "Indonesia",
        "IR": "Iran",
        "IQ": "Iraq",
        "IE": "Ireland",
        "IM": "Isle of Man",
        "IL": "Israel",
        "IT": "Italy",
        "JM": "Jamaica",
        "JP": "Japan",
        "JE": "Jersey",
        "JO": "Jordan",
        "KZ": "Kazakhstan",
        "KE": "Kenya",
        "KI": "Kiribati",
        "KP": "Korea, Democratic People's Republic of",
        "KR": "Korea, Republic of",
        "KW": "Kuwait",
        "KG": "Kyrgyzstan",
        "LA": "Lao People's Democratic Republic",
        "LV": "Latvia",
        "LB": "Lebanon",
        "LS": "Lesotho",
        "LR": "Liberia",
        "LY": "Libya",
        "LI": "Liechtenstein",
        "LT": "Lithuania",
        "LU": "Luxembourg",
        "MO": "Macao",
        "MG": "Madagascar",
        "MW": "Malawi",
        "MY": "Malaysia",
        "MV": "Maldives",
        "ML": "Mali",
        "MT": "Malta",
        "MH": "Marshall Islands",
        "MQ": "Martinique",
        "MR": "Mauritania",
        "MU": "Mauritius",
        "YT": "Mayotte",
        "MX": "Mexico",
        "FM": "Micronesia (Federated States of)",
        "MD": "Moldova, Republic of",
        "MC": "Monaco",
        "MN": "Mongolia",
        "ME": "Montenegro",
        "MS": "Montserrat",
        "MA": "Morocco",
        "MZ": "Mozambique",
        "MM": "Myanmar",
        "NA": "Namibia",
        "NR": "Nauru",
        "NP": "Nepal",
        "NL": "Netherlands",
        "NC": "New Caledonia",
        "NZ": "New Zealand",
        "NI": "Nicaragua",
        "NE": "Niger",
        "NG": "Nigeria",
        "NU": "Niue",
        "NF": "Norfolk Island",
        "MK": "North Macedonia",
        "MP": "Northern Mariana Islands",
        "NO": "Norway",
        "OM": "Oman",
        "PK": "Pakistan",
        "PW": "Palau",
        "PS": "Palestine, State of",
        "PA": "Panama",
        "PG": "Papua New Guinea",
        "PY": "Paraguay",
        "PE": "Peru",
        "PH": "Philippines",
        "PN": "Pitcairn",
        "PL": "Poland",
        "PT": "Portugal",
        "PR": "Puerto Rico",
        "QA": "Qatar",
        "RE": "Réunion",
        "RO": "Romania",
        "RU": "Russian Federation",
        "RW": "Rwanda",
        "BL": "Saint Barthélemy",
        "SH": "Saint Helena, Ascension and Tristan da Cunha",
        "KN": "Saint Kitts and Nevis",
        "LC": "Saint Lucia",
        "MF": "Saint Martin (French part)",
        "PM": "Saint Pierre and Miquelon",
        "VC": "Saint Vincent and the Grenadines",
        "WS": "Samoa",
        "SM": "San Marino",
        "ST": "Sao Tome and Principe",
        "SA": "Saudi Arabia",
        "SN": "Senegal",
        "RS": "Serbia",
        "SC": "Seychelles",
        "SL": "Sierra Leone",
        "SG": "Singapore",
        "SX": "Sint Maarten (Dutch part)",
        "SK": "Slovakia",
        "SI": "Slovenia",
        "SB": "Solomon Islands",
        "SO": "Somalia",
        "ZA": "South Africa",
        "GS": "South Georgia and the South Sandwich Islands",
        "SS": "South Sudan",
        "ES": "Spain",
        "LK": "Sri Lanka",
        "SD": "Sudan",
        "SR": "Suriname",
        "SJ": "Svalbard and Jan Mayen",
        "SE": "Sweden",
        "CH": "Switzerland",
        "SY": "Syrian Arab Republic",
        "TW": "Taiwan, Province of China",
        "TJ": "Tajikistan",
        "TZ": "Tanzania, United Republic of",
        "TH": "Thailand",
        "TL": "Timor-Leste",
        "TG": "Togo",
        "TK": "Tokelau",
        "TO": "Tonga",
        "TT": "Trinidad and Tobago",
        "TN": "Tunisia",
        "TR": "Türkiye",
        "TM": "Turkmenistan",
        "TC": "Turks and Caicos Islands",
        "TV": "Tuvalu",
        "UG": "Uganda",
        "UA": "Ukraine",
        "AE": "United Arab Emirates",
        "GB": "United Kingdom",
        "US": "United States",
        "UM": "United States Minor Outlying Islands",
        "UY": "Uruguay",
        "UZ": "Uzbekistan",
        "VU": "Vanuatu",
        "VE": "Venezuela",
        "VN": "Viet Nam",
        "VG": "Virgin Islands (British)",
        "VI": "Virgin Islands (U.S.)",
        "WF": "Wallis and Futuna",
        "US-HI":"Hawaii",
        "EH": "Western Sahara",
        "YE": "Yemen",
        "ZM": "Zambia",
        "ZW": "Zimbabwe"
      };

      const fullCountryName = countryCodeMap[countryCode.toUpperCase()] || countryCode;
      console.log(`🔍 Mapped ${countryCode} to ${fullCountryName}`);

      const countryPricing = COUNTRY_PRICING.find(c => 
        c.country.toLowerCase() === fullCountryName.toLowerCase()
      );

      if (countryPricing) {
        const allowedTypes = Object.entries(countryPricing)
          .filter(([key, value]) => key !== "country" && value !== null)
          .map(([key]) => key);

        console.log(`🎯 Allowed bundle types for ${countryPricing.country}:`, allowedTypes);

        finalBundles = finalBundles
          .filter(bundle => allowedTypes.includes(bundle.bundleType))
          .map(bundle => ({
            ...bundle,
            price: countryPricing[bundle.bundleType] || bundle.price
          }));

        console.log(`✅ Final bundles count for ${countryPricing.country}: ${finalBundles.length}`);
      } else {
        console.log("⚠️ No country pricing found for:", fullCountryName);
      }
    } else {
      console.log("⚠️ No countryCode parameter provided");
    }

    // ✅ Remove plans more than 30 days
    finalBundles = finalBundles.filter(bundle => bundle.duration <= 30);

    console.log("📦 Total Bundles After Filtering:", finalBundles.length);

    // Cache the final bundles
    await redis.set(cacheKey, JSON.stringify(finalBundles), 'EX', 3600); // Cache for 1 hour

    res.status(200).json({
      message: "Catalogue fetched successfully",
      total: finalBundles.length,
      bundles: finalBundles,
    });
  } catch (error) {
    console.error("❌ Error fetching catalogue", error.message);
    res.status(500).json({
      message: "Failed to fetch catalogue",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};


// ✅ Regional catalogue function
const getEsimgoCatalogueRegionalWithPricing = async (req, res) => {
  try {
    const API_KEY = process.env.ESIMGO_API_KEY || "xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR";
    const BASE_URL = "https://api.esim-go.com/v2.5/catalogue";
    const { regionName } = req.query;

    const cacheKey = `esimgo_regional_catalogue_${regionName ? regionName.toLowerCase() : 'all'}`;

    // Check Redis cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("🌍 Cache hit for eSIMGO regional catalogue");
      const finalBundles = JSON.parse(cachedData);
      return res.status(200).json({
        message: "Regional catalogue fetched successfully with pricing",
        total: finalBundles.length,
        bundles: finalBundles,
      });
    }

    console.log("🌍 Fetching eSIMGO regional catalogue with pricing...");
    let requestUrl = `${BASE_URL}?perPage=100&direction=asc`;
    if (regionName) {
      requestUrl += `&description=${regionName}`;
    }

    const response = await axios.get(requestUrl, {
      headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    });

    const { bundles } = response.data;

    // ✅ Beautify API response
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

    // 🌍 Apply regional pricing
    let bundlesWithRegionalPricing = applyRegionalPricingMiddleware(beautified, "esimgo");

    // ✅ Remove duplicates by "name"
    const seen = new Set();
    bundlesWithRegionalPricing = bundlesWithRegionalPricing.filter(bundle => {
      if (seen.has(bundle.name)) return false;
      seen.add(bundle.name);
      return true;
    });

    // ✅ Separate UL-family bundles
    const ulFamily = bundlesWithRegionalPricing.filter(bundle => {
      const lowerName = bundle.name.toLowerCase();
      return (lowerName.includes("ul") || lowerName.includes("ulp") || lowerName.includes("ule"));
    });

    // ✅ From UL-family, keep only ULE
    const uleOnly = ulFamily.filter(bundle =>
      bundle.name.toLowerCase().includes("ule")
    );

    // ✅ Keep all non-UL-family bundles
    const nonUlFamily = bundlesWithRegionalPricing.filter(bundle => {
      const lowerName = bundle.name.toLowerCase();
      return !(lowerName.includes("ul") || lowerName.includes("ulp") || lowerName.includes("ule"));
    });

    // ✅ Combine UL filtering result
    const ulFiltered = [...nonUlFamily, ...uleOnly];

    // ✅ Categorize bundles
    const categorized = ulFiltered.map(bundle => {
      const bundleType = categorizeBundleType(bundle);
      return { ...bundle, bundleType };
    });

    // ✅ Keep only allowed plans
    let finalBundles = categorized.filter(bundle => allowedPlans.has(bundle.bundleType));

    // ✅ Dynamic regional filter
    if (regionName) {
      const regionPricing = REGIONAL_PRICING.find(r => 
        r.region.toLowerCase() === regionName.toLowerCase()
      );

      if (regionPricing) {
        const allowedTypes = Object.entries(regionPricing)
          .filter(([key, value]) => key !== "region" && value !== null)
          .map(([key]) => key);

        finalBundles = finalBundles
          .filter(bundle => allowedTypes.includes(bundle.bundleType))
          .map(bundle => ({
            ...bundle,
            price: regionPricing[bundle.bundleType] || bundle.price // ✅ override price if region has it
          }));
      }
    }

    // ✅ Remove all plans more than 30 days
    finalBundles = finalBundles.filter(bundle => bundle.duration <= 30);

    // ✅ If region is Europe, remove Europe Lite and only show Europe+
    if (regionName && regionName.toLowerCase() === 'europe') {
      finalBundles = finalBundles.filter(bundle => bundle.region === 'Europe' && bundle.countries[0] === 'Europe+');
    }

    // ✅ If region is Africa, remove Middle East and Central African Republic
    if (regionName && regionName.toLowerCase() === 'africa') {
      finalBundles = finalBundles.filter(bundle => bundle.countries[0] !== 'Middle East' && bundle.countries[0] !== 'Central African Republic' && bundle.countries[0] !== "South Africa");
    }
      if (regionName && regionName.toLowerCase() === "middle east") {
        finalBundles = finalBundles.filter(bundle => !bundle.name.includes("RMENA"));
      }
    console.log("📦 Total Bundles After Filtering (<=30 days):", finalBundles.length);

    // Cache the final bundles
    await redis.set(cacheKey, JSON.stringify(finalBundles), 'EX', 3600); // Cache for 1 hour

    res.status(200).json({
      message: "Regional catalogue fetched successfully with pricing",
      total: finalBundles.length,
      bundles: finalBundles,
    });
  } catch (error) {
    console.error("❌ Error fetching regional catalogue", error.message);
    res.status(500).json({
      message: "Failed to fetch regional catalogue",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

// Modified getSpecificBundle with intelligent pricing detection
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

    const cacheKey = `esimgo_specific_bundle_${name}`;
    
    // Check Redis cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("🌍 Cache hit for specific eSIMGO bundle");
      const bundleWithPricing = JSON.parse(cachedData);
      return res.status(200).json({
        message: "Bundle fetched successfully",
        bundle: bundleWithPricing,
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
      region: bundle.countries[0]?.country?.region || null, // Add region info
    };
    
    let bundleWithPricing;
    
    // Check if this is a regional bundle
    if (isRegionalBundle(beautified)) {
      console.log("🌍 Detected regional bundle - applying regional pricing...");
      bundleWithPricing = applySingleBundleRegionalPricing(beautified, "esimgo");
    } else {
      console.log("💰 Detected country-specific bundle - applying country pricing...");
      bundleWithPricing = applySingleBundleCountryPricing(beautified, "esimgo");
    }

    // Cache the bundle with pricing
    await redis.set(cacheKey, JSON.stringify(bundleWithPricing), 'EX', 3600); // Cache for 1 hour
    
    res.status(200).json({
      message: "Bundle fetched successfully",
      bundle: bundleWithPricing,
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


// Export the new function to manually refresh pricing
module.exports = {
  getEsimgoCatalogue,
  getSpecificBundle,
  createPaymentIntent,
  confirmPaymentAndCreateEsim,
  handleStripeWebhook,
  getPaymentStatus,
  getOrderDetails,
  getEsimgoCatalogueRegionalWithPricing,
  getEsimDetails,
  // Export middleware functions for potential reuse
  applyCountryPricingMiddleware,
  applySingleBundleCountryPricing,
  // Export pricing management functions
  updateCountryPricing,
  addCountryPricing,
  getAllCountryPricing,
  getSpecificRegionalBundle,
  getCountryPricing,
  // New functions for API-based pricing
  fetchCountryPricingFromAPI,
  initializeCountryPricing,
  COUNTRY_PRICING, // Still exportable but now dynamically populated
  DEFAULT_PRICING
};