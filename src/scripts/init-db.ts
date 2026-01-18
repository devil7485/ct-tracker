import { initializeDatabase } from '../lib/db';

console.log('🚀 Initializing database...\n');

try {
  initializeDatabase();
  console.log('\n✅ Database initialization complete!');
  console.log('📁 Database created at: ./data/ct-tracker.db');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}
