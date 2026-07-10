import React, { useEffect, memo } from "react";

function getModalClass(size) {
  if (size === "lg") return "modal modal--lg";
  if (size === "xl") return "modal modal--xl";
  return "modal";
}

const Modal = memo(function Modal({ title, children, onClose, size, actions }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={getModalClass(size)} onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="modal__title">{title}</h3>}
        {children}
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
});

export default Modal;
