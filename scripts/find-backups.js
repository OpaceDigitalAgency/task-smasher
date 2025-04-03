import fs from 'node:fs';
import path from 'node:path';

/**
 * Find all backups directories and list their contents
 * @param {string} startDir - Directory to start searching from
 */
function findBackups(startDir = '.') {
  const results = {
    backupDirs: [],
    versionDirs: [],
    backupFiles: []
  };
  
  function scan(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name === 'backups') {
            results.backupDirs.push(fullPath);
            
            // Look for version directories within backups
            const versionEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const versionEntry of versionEntries) {
              if (versionEntry.isDirectory() && versionEntry.name.startsWith('v')) {
                const versionPath = path.join(fullPath, versionEntry.name);
                results.versionDirs.push(versionPath);
                
                // Get files in this version directory (recursive)
                function collectFiles(dirPath, basePath = '') {
                  const files = fs.readdirSync(dirPath, { withFileTypes: true });
                  for (const file of files) {
                    const filePath = path.join(dirPath, file.name);
                    const relativePath = path.join(basePath, file.name);
                    
                    if (file.isDirectory()) {
                      collectFiles(filePath, relativePath);
                    } else {
                      results.backupFiles.push({
                        path: filePath,
                        version: versionEntry.name,
                        relativePath: relativePath
                      });
                    }
                  }
                }
                
                collectFiles(versionPath);
              }
            }
          } else {
            // Skip node_modules and other large directories
            if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.git')) {
              scan(fullPath);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning ${dir}:`, err.message);
    }
  }
  
  scan(startDir);
  return results;
}

// Main execution
const backups = findBackups('/home/project');

console.log('\n=== BACKUP DIRECTORIES ===');
if (backups.backupDirs.length === 0) {
  console.log('No backup directories found.');
  console.log('This could mean no backups have been created yet.');
  console.log('Try making changes to a file and then running the backup script:');
  console.log('  npm run backup');
} else {
  backups.backupDirs.forEach(dir => console.log(dir));
}

console.log('\n=== BACKUP VERSIONS ===');
if (backups.versionDirs.length === 0) {
  console.log('No backup versions found.');
} else {
  backups.versionDirs.forEach(dir => {
    const versionName = path.basename(dir);
    console.log(`${dir} (${versionName})`);
  });
}

console.log('\n=== BACKUP FILES ===');
if (backups.backupFiles.length === 0) {
  console.log('No backup files found.');
} else {
  // Group files by version
  const filesByVersion = {};
  
  backups.backupFiles.forEach(file => {
    if (!filesByVersion[file.version]) {
      filesByVersion[file.version] = [];
    }
    filesByVersion[file.version].push(file);
  });
  
  // Display files grouped by version
  Object.keys(filesByVersion).sort().forEach(version => {
    console.log(`\nVersion: ${version}`);
    filesByVersion[version].forEach(file => {
      console.log(`  ${file.relativePath}`);
    });
  });
}