import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      position="top-center"
      toastOptions={{
        style: { fontFamily: "Inter, sans-serif" },
      }}
      {...props}
    />
  );
}
