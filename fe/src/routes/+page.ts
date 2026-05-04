export async function load({ url }) {
  // Only compute currentDate from URL — data fetching happens client-side
  const dateParam = url.searchParams.get('date');
  const now = new Date();
  const localDate = dateParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return { currentDate: localDate };
}
