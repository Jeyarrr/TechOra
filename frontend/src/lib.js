export const categories = ['All', 'Smartphones', 'Laptops', 'Audio', 'Wearables', 'Tablets', 'Home office', 'Accessories'];
export const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
export const emptyRegistration = { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: 'Philippines', marketing: false };

export async function readResponse(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error('The server could not complete this request. Please try again.'); }
  if (!response.ok) throw new Error(data.message || data.error || 'Unable to complete this request.');
  return data;
}
