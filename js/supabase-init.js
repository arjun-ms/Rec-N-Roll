//! --------------------------old code begins-----------------------------------------

// Initialize Supabase client
// const supabaseUrl = 'https://scbzbffwuovxqlnmgvxb.supabase.co';
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnpiZmZ3dW92eHFsbm1ndnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyOTAwNTAsImV4cCI6MjA1Mzg2NjA1MH0.eRNLhMojEXbgAO9PXbk6yjZMA34e0aJiOQzJPBDL3fc';
// // Initialize Supabase client with better error handling
// async function initializeSupabase() {
//     const MAX_RETRIES = 10;
//     const RETRY_DELAY = 5000;
//     let attempts = 0;

//     while (attempts < MAX_RETRIES) {
//         try {
//             if (typeof supabase === 'undefined') {
//                 console.log(`Waiting for Supabase library (attempt ${attempts + 1}/${MAX_RETRIES})...`);
//                 await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
//                 attempts++;
//                 continue;
//             }
//             console.log('🚀 Initializing Supabase client...');
//             window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
//             console.log('✅ Supabase client initialized:', window.supabaseClient);
//             return true;
//         } catch (error) {
//             console.error('Error initializing Supabase:', error);
//             attempts++;
//             if (attempts === MAX_RETRIES) {
//                 throw new Error('Failed to initialize Supabase after multiple attempts');
//             }
//             await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
//         }
//     }
//     return false;
// }

// // Start initialization when the script loads
// initializeSupabase().catch(error => {
//     console.error('Failed to initialize Supabase:', error);
// });
//! --------------------------old code ends-----------------------------------------


document.addEventListener('DOMContentLoaded', async () => {
    const supabaseUrl = 'https://scbzbffwuovxqlnmgvxb.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnpiZmZ3dW92eHFsbm1ndnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyOTAwNTAsImV4cCI6MjA1Mzg2NjA1MH0.eRNLhMojEXbgAO9PXbk6yjZMA34e0aJiOQzJPBDL3fc';

    // Initialize client when Supabase is definitely available
    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        document.dispatchEvent(new Event('supabase-ready'));
        console.log('✅ Supabase client initialized');
    } else {
        console.error('❌ Supabase library not found! Check script loading.');
    }
});