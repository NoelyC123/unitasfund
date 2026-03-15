export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#f7f4ef" }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
