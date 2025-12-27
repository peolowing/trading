export default async function handler(req, res) {
  try {
    res.json({ message: "Test endpoint works!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
