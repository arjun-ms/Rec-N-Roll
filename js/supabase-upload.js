// // Supabase configuration
// ! --------------------------old code begins-----------------------------------------
// const SUPABASE_URL = "https://scbzbffwuovxqlnmgvxb.supabase.co";
// const SUPABASE_KEY =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnpiZmZ3dW92eHFsbm1ndnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyOTAwNTAsImV4cCI6MjA1Mzg2NjA1MH0.eRNLhMojEXbgAO9PXbk6yjZMA34e0aJiOQzJPBDL3fc";

// class SupabaseUploader {
//   constructor() {
//     this.client = null;
//     this.initializeClient();
//     console.log("SupabaseUploader instance created");
//   }

//   async initializeClient() {
//     const MAX_RETRIES = 10;
//     const RETRY_DELAY = 5000;
//     let attempts = 0;

//     while (attempts < MAX_RETRIES) {
//       if (typeof window.supabaseClient === "undefined") {
//         console.log(
//           `Waiting for Supabase client (attempt ${attempts + 1}/${MAX_RETRIES})...`
//         );
//         await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
//         attempts++;
//         continue;
//       }
//       this.client = window.supabaseClient;
//       console.log("✅SupabaseUploader initialized with client:", this.client);
//       return;
//     }
//     throw new Error("Supabase client initialization timeout");
//   }

//   async uploadVideo(blob, filename) {
//     try {
//       console.log("Starting upload with:", { blob, filename });

//       if (!this.client) {
//         throw new Error("Supabase client not initialized");
//       }

//       if (!blob) {
//         throw new Error("No blob provided for upload");
//       }

//       // Generate a unique filename
//       const timestamp = new Date().getTime();
//       const uniqueFilename = `${timestamp}_${filename}`;
//       console.log("Generated filename:", uniqueFilename);

//       // Upload the video to Supabase Storage
//       const { data, error } = await this.client.storage
//         .from("videos")
//         .upload(uniqueFilename, blob, {
//           contentType: blob.type,
//           cacheControl: "3600",
//         });

//       if (error) {
//         console.error("Error uploading to Supabase:", error);
//         throw error;
//       }

//       console.log("Upload successful:", data);

//       // Get the public URL
//       const { data: { publicUrl } } = this.client.storage
//         .from("videos")
//         .getPublicUrl(uniqueFilename);

//       console.log("Public URL generated:", publicUrl);

//       return {
//         success: true,
//         url: publicUrl,
//         filename: uniqueFilename,
//       };
//     } catch (error) {
//       console.error("Upload failed:", error);
//       return {
//         success: false,
//         error: error.message || "Upload failed",
//       };
//     }
//   }
// }

// // Create and expose a single instance globally
// window.supabaseUploader = new SupabaseUploader();

//! --------------------------old code ends-----------------------------------------

// Supabase configuration
const SUPABASE_URL = "https://scbzbffwuovxqlnmgvxb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnpiZmZ3dW92eHFsbm1ndnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyOTAwNTAsImV4cCI6MjA1Mzg2NjA1MH0.eRNLhMojEXbgAO9PXbk6yjZMA34e0aJiOQzJPBDL3fc";

class SupabaseUploader {
   constructor() {
       this.client = null;
       this.initializeClient();
       console.log("SupabaseUploader instance created");
   }

   initializeClient() {
       // If client already exists, use it
       if (window.supabaseClient) {
           this.client = window.supabaseClient;
           return Promise.resolve();
       }

       // Otherwise wait for the ready event
       return new Promise((resolve) => {
           document.addEventListener('supabase-ready', () => {
               this.client = window.supabaseClient;
               console.log("✅SupabaseUploader initialized with client:", this.client);
               resolve();
           });
       });
   }

   async uploadVideo(blob, filename) {
       try {
           console.log("Starting upload with:", { blob, filename });

           // Ensure client is initialized
           await this.initializeClient();

           if (!this.client) {
               throw new Error("Failed to initialize Supabase client");
           }

           if (!blob) {
               throw new Error("No blob provided for upload");
           }

           // Generate a formatted date-time filename
           const now = new Date();
           const day = String(now.getDate()).padStart(2, '0');
           const month = String(now.getMonth() + 1).padStart(2, '0');
           const year = now.getFullYear();
           const hours = String(now.getHours()).padStart(2, '0');
           const minutes = String(now.getMinutes()).padStart(2, '0');
           const seconds = String(now.getSeconds()).padStart(2, '0');
           const period = now.getHours() >= 12 ? 'PM' : 'AM';
           
           const formattedDateTime = `screen-recording-${day}-${month}-${year}--${hours}:${minutes}:${seconds}-${period}.webm`;
           const uniqueFilename = formattedDateTime;
           
           console.log("Generated filename:", uniqueFilename);

           // Upload the video to Supabase Storage
           const { data, error } = await this.client.storage
               .from("videos") // Make sure this bucket exists in your Supabase project
               .upload(uniqueFilename, blob, {
                   contentType: blob.type,
                   cacheControl: "3600",
               });

           if (error) {
               console.error("Error uploading to Supabase:", error);
               throw error;
           }

           console.log("Upload successful:", data);

           // Get the public URL
           const { data: { publicUrl } } = this.client.storage
               .from("videos")
               .getPublicUrl(uniqueFilename);

           console.log("Public URL generated:", publicUrl);

           return {
               success: true,
               url: publicUrl,
               filename: uniqueFilename,
           };
       } catch (error) {
           console.error("Upload failed:", error);
           return {
               success: false,
               error: error.message || "Upload failed",
           };
       }
   }
}

// Create and expose a single instance globally
window.supabaseUploader = new SupabaseUploader();