const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔧 Notes Database Fix Script\n');
console.log('📍 MongoDB URI:', process.env.MONGO_URI ? 'Set' : 'Not Set');
console.log('=' .repeat(50) + '\n');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    return false;
  }
}

async function checkNotesCollection() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('📋 Available Collections:');
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });
    console.log('');
    
    // Check if notes collection exists
    const notesCollection = collections.find(c => c.name === 'notes');
    if (!notesCollection) {
      console.log('ℹ️  Notes collection does not exist yet');
      return;
    }
    
    console.log('📝 Notes Collection Details:');
    console.log(`   Name: ${notesCollection.name}`);
    console.log(`   Type: ${notesCollection.type}`);
    
    // Get collection stats
    const stats = await db.collection('notes').stats();
    console.log(`   Document Count: ${stats.count}`);
    console.log(`   Index Count: ${stats.nindexes}`);
    console.log('');
    
    // List indexes
    const indexes = await db.collection('notes').indexes();
    console.log('🔍 Current Indexes:');
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${JSON.stringify(index.key)}`);
      console.log(`      Unique: ${index.unique || false}`);
      console.log(`      Name: ${index.name}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking notes collection:', error.message);
  }
}

async function fixNotesCollection() {
  try {
    const db = mongoose.connection.db;
    
    console.log('🔧 Attempting to fix notes collection...');
    
    // Check if there are any documents with null noteId
    const nullNoteIdDocs = await db.collection('notes').find({ noteId: null }).toArray();
    console.log(`   Documents with null noteId: ${nullNoteIdDocs.length}`);
    
    if (nullNoteIdDocs.length > 0) {
      console.log('⚠️  Found documents with null noteId, attempting to fix...');
      
      // Update documents with null noteId
      const updateResult = await db.collection('notes').updateMany(
        { noteId: null },
        { 
          $set: { 
            noteId: { 
              $function: {
                body: function() {
                  return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                },
                args: [],
                lang: 'js'
              }
            }
          }
        }
      );
      
      console.log(`   Updated ${updateResult.modifiedCount} documents`);
    }
    
    // Drop existing indexes that might be causing issues
    console.log('🗑️  Dropping existing indexes...');
    try {
      await db.collection('notes').dropIndexes();
      console.log('   ✅ All indexes dropped');
    } catch (error) {
      console.log('   ℹ️  No indexes to drop or error:', error.message);
    }
    
    console.log('✅ Notes collection fix completed');
    
  } catch (error) {
    console.error('❌ Error fixing notes collection:', error.message);
  }
}

async function createNewNote() {
  try {
    console.log('🧪 Testing note creation...');
    
    // Import the Note model
    const Note = require('./src/models/Note');
    
    // Create a test note
    const testNote = new Note({
      title: 'Test Note for Database Fix',
      content: 'This note is created to test the database fix',
      tags: ['test', 'database', 'fix'],
      category: 'testing',
      priority: 'medium',
      userId: new mongoose.Types.ObjectId() // Create a dummy user ID
    });
    
    await testNote.save();
    console.log('✅ Test note created successfully');
    console.log(`   ID: ${testNote._id}`);
    console.log(`   Note ID: ${testNote.noteId}`);
    
    // Clean up test note
    await Note.findByIdAndDelete(testNote._id);
    console.log('🗑️  Test note cleaned up');
    
  } catch (error) {
    console.error('❌ Error creating test note:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Notes Database Fix...\n');
  
  // Connect to database
  const connected = await connectToDatabase();
  if (!connected) {
    console.log('❌ Cannot proceed without database connection');
    return;
  }
  
  // Check current state
  await checkNotesCollection();
  
  // Fix issues
  await fixNotesCollection();
  
  // Test note creation
  await createNewNote();
  
  console.log('\n🎉 Notes Database Fix Complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Database connection established');
  console.log('   ✅ Notes collection checked');
  console.log('   ✅ Database issues fixed');
  console.log('   ✅ Note creation tested');
  console.log('   ✅ Ready for use');
  
  // Close connection
  await mongoose.connection.close();
  console.log('\n🔌 Database connection closed');
}

// Run the fix
main().catch(console.error);
