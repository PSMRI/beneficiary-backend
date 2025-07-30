# Encryption Key Rotation

Simple and robust encryption key rotation for production environments.

## Overview

- **Single encryption key** stored in `ENCRYPTION_KEY` environment variable
- **Safe migration** with transaction rollback and error recovery
- **Batch processing** for memory efficiency

## Usage

### Generate New Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Test Migration (Dry Run)
```bash
OLD_ENCRYPTION_KEY=current_key NEW_ENCRYPTION_KEY=new_key ts-node scripts/key-rotation.ts --dry-run
```

### Execute Migration
```bash
OLD_ENCRYPTION_KEY=current_key NEW_ENCRYPTION_KEY=new_key ts-node scripts/key-rotation.ts
```

## What Gets Migrated

- **`user_docs.doc_data`** - User document data
- **`user_applications.application_data`** - Application data  
- **`fieldValues.value`** - Encrypted custom fields

## Features

✅ **Safe** - Transaction-based with rollback on failure  
✅ **Robust** - Continues processing if individual records fail  
✅ **Efficient** - Batch processing (100 records at a time)  
✅ **Detailed** - Progress tracking and error statistics  

## Important Notes

1. **Always backup database** before running migration
2. **Test with dry run** first to verify everything works
3. **Update ENCRYPTION_KEY** environment variable after successful migration
4. **Restart application** to use the new key
