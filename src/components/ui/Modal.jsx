import React, { useEffect } from "react";

export default function Modal({ title, children, onClose, size, actions }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const modalCls = size === "lg" ? "modal modal--lg" : "modal";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={modalCls} onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="modal__title">{title}</h3>}
        {children}
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
}
