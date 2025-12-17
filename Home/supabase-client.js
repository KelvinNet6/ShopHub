const supabaseUrl = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

// Destructure createClient from the global supabase object
const { createClient } = supabase;  // This uses the existing global 'supabase'

const supabaseClient = createClient(supabaseUrl, supabaseKey);

function getPublicImageUrl(path) {
  if (!path) return 'https://i.pinimg.com/736x/4a/d8/f3/4ad8f37a3820e656419f4dd0b417e3c4.jpg';
  if (path.startsWith('http')) return path;
  return `https://nhyucbgjocmwrkqbjjme.supabase.co/storage/v1/object/public/products/${path}`;
}

// Make available globally
window.supabaseClient = supabaseClient;
window.getPublicImageUrl = getPublicImageUrl;
