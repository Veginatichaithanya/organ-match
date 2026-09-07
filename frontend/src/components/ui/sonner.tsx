import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-md group-[.toaster]:rounded-lg group-[.toaster]:px-3.5 group-[.toaster]:py-2.5 group-[.toaster]:text-xs group-[.toaster]:font-medium",
          description: "group-[.toast]:text-slate-500 group-[.toast]:text-[11px]",
          actionButton: "group-[.toast]:bg-slate-900 group-[.toast]:text-white group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-xs",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
