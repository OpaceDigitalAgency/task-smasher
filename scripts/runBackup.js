import { exec } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * This script provides an API endpoint to trigger backups from the web application
 * It's executed by the FileBackupIndicator component
 */

// Get the current working directory
const cwd = process.cwd();

// Run the backup script
console.log('Running backup script from API endpoint...');

// Create a backup version
const runBackupProcess = () => {
  return new Promise((resolve, reject) => {
    exec('node scripts/backup.js', { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing backup: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Backup stderr: ${stderr}`);
      }
      console.log(`Backup stdout: ${stdout}`);
      resolve(stdout);
    });
  });
};

// Export a function that can be called from an API endpoint
export const createBackupVersion = async (req, res) => {
  try {
    const result = await runBackupProcess();
    
    // Read the metadata to confirm backup was created
    const metadataPath = path.join(cwd, 'scripts', 'backup-metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    return {
      success: true,
      message: `Backup created successfully (v${metadata.lastVersion})`,
      version: metadata.lastVersion,
      timestamp: metadata.lastBackup
    };
  } catch (error) {
    console.error('Error creating backup:', error);
    return {
      success: false,
      message: 'Failed to create backup',
      error: error.message
    };
  }
};

// If this script is run directly
if (require.main === module) {
  createBackupVersion()
    .then(result => console.log(result))
    .catch(error => console.error(error));
}