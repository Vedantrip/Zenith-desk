const fs = require('fs');
const path = require('path');

// Default categorization rules
const DEFAULT_CATEGORIES = {
  Documents: ['.pdf', '.docx', '.doc', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.odt', '.md', '.epub'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp', '.ico', '.tiff'],
  Videos: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  Audio: ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma'],
  Installers: ['.exe', '.msi', '.msix', '.bat', '.cmd', '.dmg', '.pkg'],
  Archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
  Code: ['.js', '.ts', '.html', '.css', '.json', '.py', '.java', '.cpp', '.h', '.cs', '.go', '.sh', '.xml', '.yaml', '.yml']
};

/**
 * Organizes files in the target directory based on their categories.
 * @param {string} targetDir - The path to the directory to organize.
 * @param {Object} activeRules - Object indicating which categories are active (e.g. { Documents: true, Images: true })
 * @returns {Promise<Object>} An object containing the organization summary.
 */
async function organizeDirectory(targetDir, activeRules = {}) {
  try {
    if (!fs.existsSync(targetDir)) {
      return { success: false, error: 'Directory does not exist.' };
    }

    const stats = fs.statSync(targetDir);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Target path is not a directory.' };
    }

    // Merge default rules with provided rules (if any are disabled)
    const enabledCategories = {};
    for (const key in DEFAULT_CATEGORIES) {
      enabledCategories[key] = activeRules[key] !== false;
    }

    const files = fs.readdirSync(targetDir);
    const movedFiles = [];
    let skippedCount = 0;
    let errorCount = 0;

    for (const filename of files) {
      const filePath = path.join(targetDir, filename);
      
      // Skip directories, hidden files, and desktop.ini
      const fileStats = fs.statSync(filePath);
      if (fileStats.isDirectory() || filename.startsWith('.') || filename.toLowerCase() === 'desktop.ini' || filename.toLowerCase() === 'thumbs.db') {
        continue;
      }

      const ext = path.extname(filename).toLowerCase();
      let category = null;

      // Determine category
      for (const catName in DEFAULT_CATEGORIES) {
        if (enabledCategories[catName] && DEFAULT_CATEGORIES[catName].includes(ext)) {
          category = catName;
          break;
        }
      }

      // If category matches, move the file
      if (category) {
        const destDir = path.join(targetDir, category);
        
        // Ensure destination folder exists
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        let destFilePath = path.join(destDir, filename);

        // Resolve name collisions (e.g., file (1).txt)
        if (fs.existsSync(destFilePath)) {
          const nameWithoutExt = path.basename(filename, ext);
          let counter = 1;
          while (fs.existsSync(destFilePath)) {
            const newName = `${nameWithoutExt} (${counter})${ext}`;
            destFilePath = path.join(destDir, newName);
            counter++;
          }
        }

        try {
          fs.renameSync(filePath, destFilePath);
          movedFiles.push({
            original: filename,
            newPath: path.relative(targetDir, destFilePath),
            category: category
          });
        } catch (renameErr) {
          console.error(`Error moving file ${filename}:`, renameErr);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return {
      success: true,
      organizedCount: movedFiles.length,
      skippedCount,
      errorCount,
      details: movedFiles
    };
  } catch (error) {
    console.error('Error during directory organization:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  organizeDirectory,
  DEFAULT_CATEGORIES
};
