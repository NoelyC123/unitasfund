export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen px-4"
      style={{ backgroundColor: "#f7f4ef" }}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}
