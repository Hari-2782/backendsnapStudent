const cloudinary = require('cloudinary').v2;

// Load environment variables
require('dotenv').config();

let isConfigured = false;

/**
 * Configure Cloudinary with environment variables
 */
const configureCloudinary = () => {
  if (isConfigured) {
    console.log('✅ Cloudinary already configured');
    return true;
  }

  console.log('🔧 Configuring Cloudinary...');
  console.log('📋 Environment check:');
  console.log(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}`);

  // Check if environment variables are set
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary environment variables missing:');
    console.error(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'}`);
    console.error(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET'}`);
    console.error(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'}`);
    throw new Error('Cloudinary environment variables are not properly configured');
  }

  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    isConfigured = true;
    console.log('✅ Cloudinary configured successfully');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to configure Cloudinary:', error);
    throw error;
  }
};

/**
 * Get configured Cloudinary instance
 */
const getCloudinary = () => {
  if (!isConfigured) {
    configureCloudinary();
  }
  return cloudinary;
};

/**
 * Check if Cloudinary is configured
 */
const isCloudinaryConfigured = () => {
  return isConfigured;
};

/**
 * Test Cloudinary connection
 */
const testConnection = async () => {
  try {
    if (!isConfigured) {
      configureCloudinary();
    }
    
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection test successful:', result);
    return { success: true, result };
  } catch (error) {
    console.error('❌ Cloudinary connection test failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Auto-configure on module load
try {
  configureCloudinary();
} catch (error) {
  console.error('❌ Failed to auto-configure Cloudinary:', error.message);
}

module.exports = {
  configureCloudinary,
  getCloudinary,
  isCloudinaryConfigured,
  testConnection,
  cloudinary // Export the configured instance
};
