const axios = require('axios');

// Platform adapter to handle differences between Facebook and Instagram
class PlatformAdapter {
  constructor() {
    this.FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';
    this.INSTAGRAM_API_URL = 'https://graph.facebook.com/v18.0'; // Same base URL
  }

  // Get the appropriate access token based on platform
  getAccessToken(platform = 'facebook') {
    if (platform === 'instagram') {
      // Use Instagram Page Access Token if available, then Instagram token, then regular page token
      return process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    }
    return process.env.PAGE_ACCESS_TOKEN;
  }

  // Get API URL for sending messages
  getMessageApiUrl(platform = 'facebook') {
    // Both platforms use the same endpoint structure
    const baseUrl = platform === 'instagram' ? this.INSTAGRAM_API_URL : this.FACEBOOK_API_URL;
    return `${baseUrl}/me/messages`;
  }

  // Format message data according to platform requirements
  formatMessageData(recipientId, message, platform = 'facebook') {
    if (platform === 'instagram') {
      // Instagram message format
      return {
        recipient: { id: recipientId },
        message: {
          text: message
        }
      };
    }
    
    // Facebook message format (same structure for both)
    return {
      recipient: { id: recipientId },
      message: {
        text: message
      }
    };
  }

  // Format typing indicator data
  formatTypingIndicator(recipientId, isTyping = true, platform = 'facebook') {
    // Both platforms use the same format for typing indicators
    return {
      recipient: { id: recipientId },
      sender_action: isTyping ? "typing_on" : "typing_off"
    };
  }

  // Send message through the appropriate platform
  async sendMessage(recipientId, text, platform = 'facebook') {
    const messageData = this.formatMessageData(recipientId, text, platform);
    const apiUrl = this.getMessageApiUrl(platform);
    const accessToken = this.getAccessToken(platform);
    
    try {
      const response = await axios.post(
        apiUrl,
        messageData,
        { 
          params: { 
            access_token: accessToken 
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Message sent successfully via ${platform}`);
      return response.data;
    } catch (error) {
      console.error(`Error sending ${platform} message:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Send typing indicator
  async sendTypingIndicator(recipientId, isTyping = true, platform = 'facebook') {
    const messageData = this.formatTypingIndicator(recipientId, isTyping, platform);
    const apiUrl = this.getMessageApiUrl(platform);
    const accessToken = this.getAccessToken(platform);
    
    try {
      const response = await axios.post(
        apiUrl,
        messageData,
        { 
          params: { 
            access_token: accessToken 
          }
        }
      );
      
      console.log(`${platform} typing indicator ${isTyping ? 'on' : 'off'} sent`);
      return response.data;
    } catch (error) {
      console.error(`Error sending ${platform} typing indicator:`, error.response?.data || error.message);
      // Don't throw - typing indicators are not critical
    }
  }

  // Get user profile based on platform
  async getUserProfile(userId, platform = 'facebook') {
    try {
      const accessToken = this.getAccessToken(platform);
      let fields = 'first_name,last_name,profile_pic,locale,timezone';
      
      if (platform === 'instagram') {
        // Instagram has different available fields
        fields = 'username,name,profile_pic';
      }
      
      const baseUrl = platform === 'instagram' ? this.INSTAGRAM_API_URL : this.FACEBOOK_API_URL;
      
      const response = await axios.get(
        `${baseUrl}/${userId}`,
        {
          params: {
            fields: fields,
            access_token: accessToken
          }
        }
      );
      
      // Normalize the response
      if (platform === 'instagram') {
        return {
          name: response.data.name || response.data.username || 'Instagram User',
          first_name: response.data.name?.split(' ')[0] || response.data.username,
          last_name: response.data.name?.split(' ').slice(1).join(' ') || '',
          profile_pic: response.data.profile_pic,
          username: response.data.username,
          platform: 'instagram'
        };
      }
      
      // Facebook profile
      return {
        name: `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim() || 'User',
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        profile_pic: response.data.profile_pic,
        locale: response.data.locale,
        timezone: response.data.timezone,
        platform: 'facebook'
      };
      
    } catch (error) {
      console.error(`Error fetching ${platform} user profile:`, error.response?.data || error.message);
      
      // Return default data if API call fails
      return {
        name: platform === 'instagram' ? 'Instagram User' : 'User',
        profile_pic: null,
        platform: platform
      };
    }
  }

  // Format quick replies for platform
  formatQuickReplies(text, quickReplies, platform = 'facebook') {
    // Both platforms support quick replies with similar format
    return {
      text: text,
      quick_replies: quickReplies.map(reply => ({
        content_type: 'text',
        title: reply.title,
        payload: reply.payload || reply.title
      }))
    };
  }

  // Check if platform supports feature
  supportsFeature(feature, platform = 'facebook') {
    const features = {
      facebook: {
        quick_replies: true,
        persistent_menu: true,
        get_started: true,
        media_attachments: true,
        location_sharing: true,
        templates: true
      },
      instagram: {
        quick_replies: true,
        persistent_menu: false,
        get_started: false,
        media_attachments: true,
        location_sharing: false,
        templates: false
      }
    };
    
    return features[platform]?.[feature] || false;
  }

  // Get platform display name
  getPlatformDisplayName(platform) {
    const names = {
      facebook: 'Facebook Messenger',
      instagram: 'Instagram Direct'
    };
    return names[platform] || platform;
  }

  // Get platform icon/emoji for UI
  getPlatformIcon(platform) {
    const icons = {
      facebook: '💬',
      instagram: '📷'
    };
    return icons[platform] || '💬';
  }
}

// Export singleton instance
module.exports = new PlatformAdapter();