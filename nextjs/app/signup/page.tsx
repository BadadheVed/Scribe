import SignupForm from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <SignupForm />
    </div>
  );
}
