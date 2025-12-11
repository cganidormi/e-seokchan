"use client";

export default function TextInputField({
  value,
  onChange,
  placeholder,
  hidden,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hidden?: boolean;
}) {
  const inputClass =
    "flex-1 p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 text-[12px] box-border";
  const titleBtnClass =
    "flex justify-center items-center bg-white rounded-full px-2 h-6 border border-gray-200 absolute left-1 top-1 text-[12px] font-bold";

  if (hidden) return null;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + " w-full"}
        placeholder={placeholder}
      />
      <span className={titleBtnClass}>{placeholder}</span>
    </div>
  );
}
