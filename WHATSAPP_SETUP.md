# WhatsApp Business API Setup Guide

This guide will help you set up WhatsApp message chatting functionality for your chatbot.

## Features

✅ **Enhanced WhatsApp Integration**
- Receive and respond to WhatsApp messages
- Document search integration - users can ask questions about uploaded PDFs
- AI-powered responses using Groq and Gemini
- Automatic message read receipts
- Support for both basic chat and document-based Q&A

## Prerequisites

1. **WhatsApp Business Account**: You need a verified WhatsApp Business account
2. **Meta for Developers Account**: Create an account at [developers.facebook.com](https://developers.facebook.com)
3. **WhatsApp Business API Access**: Apply for access through Meta

## Setup Steps

### 1. Create a WhatsApp Business App

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app and select "Business" as the app type
3. Add the "WhatsApp" product to your app

### 2. Get Your Credentials

From your WhatsApp Business API dashboard, collect these values:

- **Access Token**: Your temporary access token (expires every 24 hours)
- **Phone Number ID**: The ID of your WhatsApp Business phone number
- **App Secret**: Your app's secret key
- **Verify Token**: A custom string you create for webhook verification

### 3. Configure Environment Variables

Update your `.env` file with the WhatsApp credentials:

```env
# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token_here
WHATSAPP_APP_SECRET=your_app_secret_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_API_VERSION=v18.0

# AI Services (required for enhanced responses)
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Set Up Webhook

1. **Start your server**: `npm start`
2. **Expose your local server** (for development):
   - Use ngrok: `ngrok http 3001`
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. **Configure webhook in Meta dashboard**:
   - Webhook URL: `https://your-domain.com/webhook/whatsapp`
   - Verify Token: Use the same token from your `.env` file
   - Subscribe to: `messages` events

### 5. Test Your Setup

1. **Check status**: Visit `http://localhost:3001/whatsapp/status`
2. **Send test message**: Use the API endpoint or send a message to your WhatsApp Business number
3. **Monitor logs**: Check console for any errors

## API Endpoints

### Status Check
```
GET /whatsapp/status
```
Returns the current configuration status.

### Send Message (Testing)
```
POST /whatsapp/send
Content-Type: application/json

{
  "to": "1234567890",
  "message": "Hello from the chatbot!"
}
```

### Webhook Endpoints
- `GET /webhook/whatsapp` - Webhook verification
- `POST /webhook/whatsapp` - Receive messages

## How It Works

### Message Flow

1. **User sends WhatsApp message** → Your webhook receives it
2. **System processes message**:
   - Optimizes query using Gemini AI (if available)
   - Searches uploaded documents for relevant content
   - Generates AI response with context
3. **Bot responds** with relevant information from documents or general AI response

### Document Integration

When users ask questions, the system:
- Searches through uploaded PDF documents
- Finds relevant content using vector similarity
- Generates contextual responses using AI
- Provides concise, WhatsApp-friendly answers

## Troubleshooting

### Common Issues

**1. Token Expired Error (401)**
```
Error validating access token: Session has expired
```
**Solution**: WhatsApp tokens expire every 24 hours. Get a new token from Meta dashboard.

**2. Webhook Verification Failed**
**Solution**: Ensure your `WHATSAPP_VERIFY_TOKEN` matches what you set in Meta dashboard.

**3. Messages Not Sending**
**Solution**: Check your phone number ID and access token are correct.

**4. No AI Responses**
**Solution**: Ensure `GROQ_API_KEY` and/or `GEMINI_API_KEY` are configured.

### Debug Mode

Enable detailed logging by checking the console output when running `npm start`.

## Production Deployment

### 1. Get Permanent Access Token
- Apply for production access through Meta
- Get a permanent access token (doesn't expire every 24 hours)

### 2. Secure Your Webhook
- Use HTTPS in production
- Implement proper webhook signature verification
- Set up proper error handling and logging

### 3. Scale Considerations
- Implement rate limiting
- Add message queuing for high volume
- Monitor API usage and costs

## Features in Detail

### Enhanced Chat Capabilities
- **Document Q&A**: Users can ask questions about uploaded PDFs
- **Smart Responses**: AI-powered responses using Groq and Gemini
- **Context Awareness**: Maintains conversation context
- **Error Handling**: Graceful handling of API failures

### Message Types Supported
- ✅ Text messages (full support)
- ⚠️ Media messages (basic acknowledgment)
- ⚠️ Location, contacts, etc. (basic acknowledgment)

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your WhatsApp Business account is properly configured
4. Check Meta's WhatsApp API documentation for updates

## Security Notes

- Never commit your `.env` file to version control
- Regularly rotate your access tokens
- Implement webhook signature verification in production
- Monitor for unusual API usage patterns