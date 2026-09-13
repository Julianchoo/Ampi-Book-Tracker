import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthDivider, GoogleButton } from "@/components/auth/google-button"
import { SignUpForm } from "@/components/auth/sign-up-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth, isGoogleEnabled } from "@/lib/auth"

export default async function RegisterPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/")
  }

  return (
    <div className="flex items-center justify-center p-4 pt-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl">Create an account</CardTitle>
          <CardDescription>Get started with your new account</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {isGoogleEnabled && (
            <>
              <GoogleButton label="Sign up with Google" />
              <AuthDivider />
            </>
          )}
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  )
}
