/**
 * Test script for Google Cloud Storage access
 *
 * Usage: node scripts/test-gcp-access.js
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Storage } = require('@google-cloud/storage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const credentialsPath = process.env.GOOGLE_CLOUD_CREDENTIALS || './google-credentials.json';
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'dc_audio';

// Start diagnostic
console.log('=== Google Cloud Storage Diagnostic ===');

// Check configuration
console.log('\n1. Checking configuration...');
console.log(`- Project ID: ${projectId || 'MISSING'}`);
console.log(`- Bucket name: ${bucketName}`);
console.log(`- Credentials path: ${credentialsPath}`);

// Check if credentials file exists
const credentialsFullPath = path.resolve(process.cwd(), credentialsPath);
const credentialsExist = fs.existsSync(credentialsFullPath);
console.log(`- Credentials file exists: ${credentialsExist ? 'YES' : 'NO'}`);

if (!credentialsExist) {
  console.error('\n❌ ERROR: Credentials file not found!');
  console.log('Please download your service account key from Google Cloud Console:');
  console.log('  1. Go to IAM & Admin > Service Accounts');
  console.log('  2. Find your service account and click "Manage keys"');
  console.log('  3. Create a new key (JSON format)');
  console.log('  4. Save the downloaded file as "google-credentials.json" in your project root');
  process.exit(1);
}

if (!projectId) {
  console.error('\n❌ ERROR: Project ID not set!');
  console.log('Please set GOOGLE_CLOUD_PROJECT_ID in your .env.local file');
  process.exit(1);
}

// Initialize Google Cloud Storage
console.log('\n2. Initializing Google Cloud Storage client...');
try {
  const storage = new Storage({
    keyFilename: credentialsFullPath,
    projectId,
  });
  console.log('✅ Storage client initialized successfully');

  // Test bucket access
  console.log(`\n3. Testing access to bucket "${bucketName}"...`);

  (async () => {
    try {
      // Check if bucket exists
      const [exists] = await storage.bucket(bucketName).exists();
      if (!exists) {
        console.error(`❌ Bucket "${bucketName}" not found!`);
        process.exit(1);
      }

      console.log(`✅ Bucket "${bucketName}" exists`);

      // List files in the bucket (limit to top level)
      const [files] = await storage.bucket(bucketName).getFiles({
        delimiter: '/',
      });
      console.log(`✅ Successfully listed ${files.length} files at bucket root`);

      // Try to list folders in /audio if they exist
      const [audioFiles] = await storage.bucket(bucketName).getFiles({
        prefix: 'audio/',
        delimiter: '/',
      });

      console.log(`✅ Found ${audioFiles.length} files/folders in audio/`);

      // Try to print some actual paths
      console.log('\n4. Some files in your bucket:');
      const allFiles = files.concat(audioFiles);
      allFiles.slice(0, 5).forEach(file => {
        console.log(`- ${file.name}`);
      });

      console.log(
        '\n✅ DIAGNOSIS COMPLETE: Your Google Cloud Storage setup appears to be working!'
      );
    } catch (error) {
      console.error(`\n❌ ERROR accessing bucket:`, error);
      console.log('\nPossible issues:');
      console.log("1. Your service account doesn't have access to this bucket");
      console.log('2. The bucket name is incorrect');
      console.log('3. Your credentials file is not valid or has expired');
      process.exit(1);
    }
  })();
} catch (error) {
  console.error('\n❌ ERROR initializing Storage client:', error);
  process.exit(1);
}
