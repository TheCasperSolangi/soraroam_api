const { Resend } = require('resend');
const QRCode = require('qrcode');

class EmailService {
  constructor() {
    this.resend = null;
    this.initializeResend();
  }

  // Initialize Resend client
  initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.error('❌ RESEND_API_KEY is required');
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      console.log('✅ Resend client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Resend client:', error.message);
    }
  }

  // Verify Resend configuration
  async verifyConnection() {
    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    try {
      // Test connection by getting domains (this validates the API key)
      await this.resend.domains.list();
      console.log('✅ Resend connection verified');
      return true;
    } catch (error) {
      console.error('❌ Resend connection failed:', error.message);
      return false;
    }
  }

  // Generate QR code as base64 image
  async generateQRCodeImage(activationCode) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(activationCode, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('❌ Error generating QR code:', error.message);
      return null;
    }
  }

  // Get email template
  getEmailTemplate(templateName) {
    const templates = {
      esimOrder: {
        subject: '🎉 Your eSIM Order is Ready! - Order #{orderCode}',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eSIM Order Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { font-size: 16px; opacity: 0.9; }
        .content { padding: 30px; }
        .order-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .order-info h2 { color: #667eea; margin-bottom: 15px; font-size: 20px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
        .info-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #555; }
        .value { color: #333; }
        .esim-details { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; }
        .esim-details h3 { color: #1976d2; margin-bottom: 20px; font-size: 22px; }
        .qr-code { margin: 20px 0; }
        .qr-code img { border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .activation-code { background-color: #fff; border: 2px dashed #1976d2; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 14px; word-break: break-all; }
        .instructions { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin: 25px 0; border-radius: 4px; }
        .instructions h3 { color: #e65100; margin-bottom: 15px; }
        .instructions ol { padding-left: 20px; }
        .instructions li { margin-bottom: 8px; color: #555; }
        .support { background-color: #f1f8e9; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
        .support h3 { color: #388e3c; margin-bottom: 15px; }
        .support p { color: #555; margin-bottom: 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 10px 5px; transition: transform 0.2s; }
        .button:hover { transform: translateY(-2px); }
        .footer { background-color: #333; color: white; text-align: center; padding: 25px; }
        .footer p { margin-bottom: 10px; opacity: 0.8; }
        .social-links { margin-top: 15px; }
        .social-links a { color: #667eea; margin: 0 10px; text-decoration: none; }
        @media (max-width: 600px) {
            .container { margin: 0; box-shadow: none; }
            .content { padding: 20px; }
            .info-row { flex-direction: column; }
            .label { margin-bottom: 5px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 eSIM Order Confirmed!</h1>
            <p>Your digital SIM is ready to use</p>
        </div>
        
        <div class="content">
            <p>Hello <strong>{username}</strong>,</p>
            <p>Great news! Your eSIM order has been successfully processed and is ready to use. Below you'll find all the details you need to get connected.</p>
            
            <div class="order-info">
                <h2>📋 Order Information</h2>
                <div class="info-row">
                    <span class="label">Order Code:</span>
                    <span class="value"><strong>{orderCode}</strong></span>
                </div>
                <div class="info-row">
                    <span class="label">Bundle Name:</span>
                    <span class="value">{bundleName}</span>
                </div>
                <div class="info-row">
                    <span class="label">Total Amount:</span>
                    <span class="value">{currency} {total}</span>
                </div>
                <div class="info-row">
                    <span class="label">Status:</span>
                    <span class="value">✅ Completed</span>
                </div>
                <div class="info-row">
                    <span class="label">Order Date:</span>
                    <span class="value">{orderDate}</span>
                </div>
            </div>

            <div class="esim-details">
                <h3>📱 Your eSIM Details</h3>
                
                <div class="qr-code">
                    <p><strong>Scan this QR Code to install your eSIM:</strong></p>
                    <img src="{qrCodeImage}" alt="eSIM QR Code" width="200" height="200">
                </div>
                
                <div class="activation-code">
                    <strong>Activation Code:</strong><br>
                    {activationCode}
                </div>
                
                <p><strong>ICCID:</strong> {iccid}</p>
            </div>

            <div class="instructions">
                <h3>📋 Installation Instructions</h3>
                <ol>
                    <li><strong>For iPhone:</strong> Go to Settings → Cellular → Add Cellular Plan → Scan the QR code above</li>
                    <li><strong>For Android:</strong> Go to Settings → Network & Internet → Mobile Network → Add Carrier → Scan QR code</li>
                    <li><strong>Alternative:</strong> Manually enter the activation code shown above</li>
                    <li>Follow the on-screen prompts to complete installation</li>
                    <li>Your eSIM will be ready to use once installed</li>
                </ol>
                <p><strong>Important:</strong> Install your eSIM before traveling to ensure connectivity upon arrival.</p>
            </div>

            <div class="support">
                <h3>🛠️ Need Help?</h3>
                <p>Our support team is here to help you 24/7</p>
                <a href="mailto:{supportEmail}" class="button">Contact Support</a>
                <a href="{supportUrl}" class="button">Help Center</a>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2025 Your Company Name. All rights reserved.</p>
            <p>Thank you for choosing our eSIM service!</p>
            <div class="social-links">
                <a href="#">Facebook</a> |
                <a href="#">Twitter</a> |
                <a href="#">Support</a>
            </div>
        </div>
    </div>
</body>
</html>`,
        text: `
Hello {username},

🎉 Your eSIM Order is Confirmed!

Order Details:
- Order Code: {orderCode}
- Bundle Name: {bundleName}
- Total Amount: {currency} {total}
- Status: Completed
- Order Date: {orderDate}

📱 eSIM Information:
- ICCID: {iccid}
- Activation Code: {activationCode}

📋 Installation Instructions:
1. For iPhone: Settings → Cellular → Add Cellular Plan → Use activation code
2. For Android: Settings → Network & Internet → Mobile Network → Add Carrier → Enter code manually
3. Follow on-screen prompts to complete installation

🛠️ Need help? Contact our support team at {supportEmail}

Thank you for choosing our eSIM service!

Best regards,
Your Company Team
        `
      }
    };

    return templates[templateName];
  }

  // Replace template placeholders with actual values
  replaceTemplatePlaceholders(template, data) {
    let { html, text, subject } = template;
    
    // Replace placeholders in all template parts
    Object.keys(data).forEach(key => {
      const placeholder = `{${key}}`;
      const value = data[key] || '';
      
      html = html.replace(new RegExp(placeholder, 'g'), value);
      text = text.replace(new RegExp(placeholder, 'g'), value);
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
    });

    return { html, text, subject };
  }

  // Send eSIM order confirmation email using Resend API
  async sendEsimOrderConfirmation(orderData) {
    try {
      console.log('📧 Preparing eSIM order confirmation email...');
      
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      // Extract order information
      const {
        username,
        order_code,
        bundleName,
        total,
        currency,
        createdDate,
        customerEmail,
        order = [],
        esimData = {}
      } = orderData;

      // Validate required fields
      if (!customerEmail) {
        console.log('⚠️  No customer email provided, skipping email notification');
        return { success: false, message: 'No email address provided' };
      }

      // Extract eSIM data from the order structure
      let activationCode = esimData.activationCode;
      let iccid = esimData.iccid;

      // If esimData doesn't have activationCode, extract from order structure
      if (!activationCode && Array.isArray(order) && order.length > 0) {
        const orderItem = order[0];
        if (orderItem.esims && orderItem.esims.length > 0) {
          const esim = orderItem.esims[0];
          iccid = esim.iccid;
          
          // Construct activation code in LPA format: LPA:{smdpAddress}${matchingId}
          if (esim.smdpAddress && esim.matchingId) {
            activationCode = `LPA:1$${esim.smdpAddress}$${esim.matchingId}`;
          }
        }
      }

      if (!activationCode) {
        console.log('⚠️  No activation code found, cannot send email');
        return { success: false, message: 'eSIM activation code is missing' };
      }

      console.log('📱 eSIM Data extracted:');
      console.log('➡️ ICCID:', iccid);
      console.log('➡️ Activation Code:', activationCode);

      // Generate QR code for activation
      const qrCodeImage = await this.generateQRCodeImage(activationCode);

      // Prepare template data
      const templateData = {
        username: username || 'Valued Customer',
        orderCode: order_code,
        bundleName: bundleName || 'eSIM Bundle',
        total: parseFloat(total).toFixed(2),
        currency: (currency || 'USD').toUpperCase(),
        orderDate: new Date(createdDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        iccid: iccid || 'N/A',
        activationCode: activationCode,
        qrCodeImage: qrCodeImage || '',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@company.com',
        supportUrl: process.env.SUPPORT_URL || 'https://company.com/support',
      };

      // Get and populate email template
      const template = this.getEmailTemplate('esimOrder');
      const emailContent = this.replaceTemplatePlaceholders(template, templateData);

      // Prepare attachments
      const attachments = [];
      if (qrCodeImage) {
        const qrCodeBase64 = qrCodeImage.replace(/^data:image\/png;base64,/, '');
        attachments.push({
          filename: `esim-qr-${order_code}.png`,
          content: qrCodeBase64,
        });
      }

      // Send email using Resend API
      console.log(`📤 Sending email to: ${customerEmail}`);
      const response = await this.resend.emails.send({
        from: `${process.env.FROM_NAME || 'eSIM Service'} <${process.env.FROM_EMAIL}>`,
        to: [customerEmail],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      
      console.log('✅ Email sent successfully via Resend');
      console.log('➡️ Message ID:', response.data?.id);

      return {
        success: true,
        messageId: response.data?.id,
        response: response,
        recipient: customerEmail
      };

    } catch (error) {
      console.error('❌ Error sending eSIM order confirmation email:', error.message);
      console.error('Stack:', error.stack);
      
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }

  // Send order status update email
  async sendOrderStatusUpdate(orderData, newStatus, additionalMessage = '') {
    try {
      console.log(`📧 Sending order status update email (${newStatus})...`);
      
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const { username, order_code, customerEmail } = orderData;

      if (!customerEmail) {
        console.log('⚠️  No customer email provided, skipping email notification');
        return { success: false, message: 'No email address provided' };
      }

      const statusMessages = {
        pending: 'Your order is being processed',
        processing: 'Your order is currently being processed',
        completed: 'Your order has been completed successfully',
        failed: 'There was an issue with your order',
        cancelled: 'Your order has been cancelled',
        payment_failed: 'Payment for your order has failed'
      };

      const statusEmojis = {
        pending: '⏳',
        processing: '⚙️',
        completed: '✅',
        failed: '❌',
        cancelled: '🚫',
        payment_failed: '💳'
      };

      const subject = `${statusEmojis[newStatus]} Order Update - ${order_code}`;
      const message = statusMessages[newStatus] || 'Order status updated';

      const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">${statusEmojis[newStatus]} Order Status Update</h2>
        
        <p>Hello <strong>${username || 'Customer'}</strong>,</p>
        
        <p style="font-size: 16px; margin: 20px 0;">${message}.</p>
        
        <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p><strong>Order Code:</strong> ${order_code}</p>
            <p><strong>New Status:</strong> ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</p>
        </div>
        
        ${additionalMessage ? `<p style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">${additionalMessage}</p>` : ''}
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>Your eSIM Service Team</p>
    </div>
</div>`;

      const textContent = `Hello ${username || 'Customer'},

${message}.

Order Code: ${order_code}
New Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}

${additionalMessage}

If you have any questions, please contact our support team.

Best regards,
Your eSIM Service Team`;

      const response = await this.resend.emails.send({
        from: `${process.env.FROM_NAME || 'eSIM Service'} <${process.env.FROM_EMAIL}>`,
        to: [customerEmail],
        subject: subject,
        html: htmlContent,
        text: textContent,
      });
      
      console.log('✅ Status update email sent successfully via Resend');
      console.log('➡️ Message ID:', response.data?.id);

      return {
        success: true,
        messageId: response.data?.id,
        recipient: customerEmail
      };

    } catch (error) {
      console.error('❌ Error sending order status update email:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send welcome email for new customers
  async sendWelcomeEmail(customerData) {
    try {
      console.log('📧 Sending welcome email...');
      
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }

      const { username, customerEmail } = customerData;

      if (!customerEmail) {
        return { success: false, message: 'No email address provided' };
      }

      const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">🎉 Welcome to eSIM Service!</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your gateway to global connectivity</p>
    </div>
    
    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <p>Hello <strong>${username || 'Valued Customer'}</strong>,</p>
        
        <p>Welcome to our eSIM service! We're thrilled to have you on board and look forward to keeping you connected wherever your journey takes you.</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #667eea; margin-bottom: 15px;">🌍 What you can expect:</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Instant eSIM delivery</li>
                <li style="margin-bottom: 8px;">Global coverage in 190+ countries</li>
                <li style="margin-bottom: 8px;">24/7 customer support</li>
                <li style="margin-bottom: 8px;">Competitive pricing</li>
                <li style="margin-bottom: 8px;">Easy installation process</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.SUPPORT_URL || '#'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: 600;">Browse eSIM Plans</a>
        </div>
        
        <p>If you have any questions or need assistance, our support team is always ready to help at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@company.com'}">${process.env.SUPPORT_EMAIL || 'support@company.com'}</a></p>
        
        <p style="margin-top: 30px;">Happy travels!<br>The eSIM Service Team</p>
    </div>
</div>`;

      const response = await this.resend.emails.send({
        from: `${process.env.FROM_NAME || 'eSIM Service'} <${process.env.FROM_EMAIL}>`,
        to: [customerEmail],
        subject: '🎉 Welcome to Our eSIM Service!',
        html: htmlContent,
      });
      
      console.log('✅ Welcome email sent successfully via Resend');

      return {
        success: true,
        messageId: response.data?.id,
        recipient: customerEmail
      };

    } catch (error) {
      console.error('❌ Error sending welcome email:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();