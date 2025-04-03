import fs from 'node:fs';
import path from 'node:path';

// Create a version identifier for this backup session
const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

// Read the version number from a metadata file, or start at v1 if it doesn't exist
let versionNumber = 1;
const metadataPath = path.join('scripts', 'backup-metadata.json');
if (fs.existsSync(metadataPath)) {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    versionNumber = metadata.lastVersion + 1;
  } catch (error) {
    console.error('Error reading version metadata, starting at v1:', error);
  }
}

// Create the version folder name
const versionFolderName = `v${versionNumber}-${dateStr}`;

// Save the updated version for next time
fs.writeFileSync(metadataPath, JSON.stringify({ lastVersion: versionNumber, lastBackup: `${dateStr}_${timeStr}` }));

// Try to update the browser's localStorage with version info by writing to a file
// that will be read by the application
try {
  const browserMetadataPath = path.join('src', 'utils', 'backup-metadata.json');
  fs.writeFileSync(browserMetadataPath, JSON.stringify({ 
    lastVersion: versionNumber,
    lastBackup: `${dateStr}_${timeStr}`
  }));
  console.log(`Updated backup metadata for browser at ${browserMetadataPath}`);
} catch (error) {
  console.log('Note: Could not update browser metadata file (this is optional)');
}

/**
 * Backup a specific file
 * @param {string} filePath Path to the file to be backed up
 */
const backupFile = (filePath) => {
  console.log(`Creating backup for ${filePath}`);
  
  // Generate backup file path with version folder
  const parsedPath = path.parse(filePath);
  const backupBaseDir = path.join(parsedPath.dir, 'backups');
  const versionDir = path.join(backupBaseDir, versionFolderName);
  
  // Preserve relative path structure for files in nested directories
  const relativePath = path.relative('/home/project', parsedPath.dir);
  const backupDir = path.join(versionDir, relativePath);
  
  const backupFilename = parsedPath.base;
  const backupPath = path.join(backupDir, backupFilename);
  
  // Create backup directory structure if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Copy the file to backup location
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`Created backup: ${backupPath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
  
  return backupPath;
};

/**
 * Lists all backups for a given file
 * @param {string} filePath Path to the original file
 * @returns Array of backup file paths
 */
const listBackups = (filePath) => {
  const parsedPath = path.parse(filePath);
  const backupBaseDir = path.join(parsedPath.dir, 'backups');
  
  if (!fs.existsSync(backupBaseDir)) {
    return [];
  }
  
  const backups = [];
  
  // Get all version folders
  const versionFolders = fs.readdirSync(backupBaseDir)
    .filter(name => name.startsWith('v') && fs.statSync(path.join(backupBaseDir, name)).isDirectory());
  
  // Look for the file in each version folder
  for (const versionFolder of versionFolders) {
    const potentialBackupPath = path.join(backupBaseDir, versionFolder, parsedPath.base);
    if (fs.existsSync(potentialBackupPath)) {
      backups.push({
        path: potentialBackupPath,
        version: versionFolder,
        date: versionFolder.split('-').slice(1).join('-')
      });
    }
  }
  
  return backups;
};

/**
 * Backup all files in a directory (recursively)
 * @param {string} dir Directory to scan
 * @param {string[]} extensions File extensions to include
 */
const backupDirectory = (dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.css']) => {
  console.log(`Backing up directory: ${dir}`);
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      // Skip backups directories
      if (file === 'backups') continue;
      
      if (stats.isDirectory()) {
        backupDirectory(filePath, extensions);
      } else if (extensions.includes(path.extname(file))) {
        backupFile(filePath);
      }
    }
  } catch (error) {
    console.error(`Error backing up directory ${dir}:`, error);
  }
};

/**
 * Creates a README file in the version folder with backup information
 */
const createVersionReadme = () => {
  const readmePath = path.join('/home/project/src/backups', versionFolderName, 'README.md');
  
  // Create the readme directory if it doesn't exist
  const readmeDir = path.dirname(readmePath);
  if (!fs.existsSync(readmeDir)) {
    fs.mkdirSync(readmeDir, { recursive: true });
  }
  
  const readmeContent = `# Backup Version ${versionNumber}

Date: ${dateStr}
Time: ${timeStr.replace('-', ':')}

This backup contains files from the TaskSmasher project.

To restore a file, copy it from this folder to the corresponding location in the project.
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log(`Created version readme: ${readmePath}`);
};

// Process command line arguments
const args = process.argv.slice(2);

console.log(`Starting backup - Version ${versionNumber} (${dateStr})`);
console.log(`Creating backup folder: v${versionNumber}-${dateStr}`);

if (args.length === 0) {
  console.log('No path specified, backing up the src directory...');
  createVersionReadme();
  backupDirectory('src');
} else {
  const targetPath = args[0];
  
  if (fs.existsSync(targetPath)) {
    const stats = fs.statSync(targetPath);
    createVersionReadme();
    
    if (stats.isDirectory()) {
      backupDirectory(targetPath);
    } else {
      backupFile(targetPath);
    }
  } else {
    console.error(`Path not found: ${targetPath}`);
  }
}

// Clear any pending backup notifications
try {
  const browserLocalStoragePath = path.join('src', 'utils', 'clear-backup-notifications.js');
  fs.writeFileSync(browserLocalStoragePath, `
    // This file is auto-generated to notify the app that backups have been performed
    export const LAST_BACKUP_VERSION = ${versionNumber};
    export const LAST_BACKUP_DATE = "${dateStr}_${timeStr}";
  `);
} catch (error) {
  console.log('Note: Could not create notification clear file (this is optional)');
}

console.log(`\x1b[32m✓ Backup completed - Version ${versionNumber} (${versionFolderName})\x1b[0m`);
console.log(`\x1b[32m✓ Files saved to: /src/backups/${versionFolderName}\x1b[0m`);