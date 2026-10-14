"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { NativeHaptics } from "@/lib/haptics";

export type SelectOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  sublabel?: string;
};

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  label,
  icon,
  accentColor: _accentColor = "#3b82f6",
  className = "",
  dropdownClassName = "",
  disabled = false,
  searchable,
  size = "md",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Normalize options into SelectOption shape
  const normalizedOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Auto-enable search if more than 8 options unless explicitly turned off
  const shouldSearch = searchable ?? normalizedOptions.length > 8;

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [normalizedOptions, searchTerm]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when open
  useEffect(() => {
    if (isOpen && shouldSearch) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldSearch]);

  const handleToggle = () => {
    if (disabled) return;
    NativeHaptics.lightTick();
    if (isOpen) {
      closeDropdown();
    } else {
      setIsOpen(true);
    }
  };

  const handleSelect = (optValue: string) => {
    NativeHaptics.lightTick();
    onChange(optValue);
    closeDropdown();
  };

  const sizeClasses = {
    sm: "py-2 px-3 text-xs rounded-xl min-h-[36px]",
    md: "py-2.5 px-3.5 text-xs sm:text-sm rounded-2xl min-h-[44px]",
    lg: "py-3 px-4 text-sm font-semibold rounded-2xl min-h-[50px]",
  }[size];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-listbox` : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border transition-all text-left flex items-center justify-between gap-2.5 outline-none font-medium select-none ${sizeClasses} ${
          isOpen
            ? "border-primary/50 ring-2 ring-primary/10 bg-muted/70"
            : "border-border/50 hover:border-border"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={`truncate ${
              selectedOption ? "text-foreground font-bold" : "text-muted-foreground font-medium"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </motion.div>
      </button>

      {/* Floating Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            className={`absolute top-full left-0 right-0 mt-2 z-[250] bg-card/95 backdrop-blur-2xl border border-border/70 rounded-2xl shadow-heavy overflow-hidden p-1.5 max-h-64 flex flex-col ${dropdownClassName}`}
          >
            {/* Search Input if enabled */}
            {shouldSearch && (
              <div className="p-1 mb-1 border-b border-border/40">
                <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-2.5 py-1.5 border border-border/40">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-transparent text-xs font-semibold outline-none text-foreground placeholder:text-muted-foreground"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              id={`${id}-listbox`}
              role="listbox"
              className="overflow-y-auto space-y-0.5 hide-scrollbar flex-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-4 px-3 text-center text-xs text-muted-foreground font-medium">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-all text-xs font-bold active:scale-[0.98] ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm font-black"
                          : "text-foreground hover:bg-muted/70 font-semibold"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="min-w-0 truncate">
                          <span className="truncate block">{opt.label}</span>
                          {opt.sublabel && (
                            <span
                              className={`text-[10px] block truncate font-medium ${
                                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                              }`}
                            >
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 shrink-0 text-current" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
