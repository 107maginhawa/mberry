import { useForm } from "react-hook-form"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "../components/form"
import { Input } from "../components/input"
import { Button } from "../components/button"

type LoginFormValues = {
  email: string
  password: string
}

const LoginForm = () => {
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    console.log("Form submitted:", values)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 w-[350px]"
      >
        <FormField
          control={form.control}
          name="email"
          rules={{ required: "Email is required", pattern: { value: /^\S+@\S+$/, message: "Invalid email" } }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormDescription>
                Enter your registered email address.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          rules={{ required: "Password is required", minLength: { value: 8, message: "Minimum 8 characters" } }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="........" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </Form>
  )
}

export const Default = () => <LoginForm />

type ProfileFormValues = {
  firstName: string
  lastName: string
}

const ProfileForm = () => {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: "Maria",
      lastName: "Santos",
    },
  })

  return (
    <Form {...form}>
      <form className="space-y-4 w-[350px]">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Update Profile</Button>
      </form>
    </Form>
  )
}

export const ProfileEdit = () => <ProfileForm />
