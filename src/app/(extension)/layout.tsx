export default function ExtensionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* PURE CONTENT - NO SIDEBAR */}
      {children}
    </div>
  );
}