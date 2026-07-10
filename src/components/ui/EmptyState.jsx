import React, { memo } from "react";

const EmptyState = memo(function EmptyState({ icon, title, message }) {
  return (
    <div className="page empty">
      {icon && <div className="empty__icon">{icon}</div>}
      {title && <h3>{title}</h3>}
      {message && <p>{message}</p>}
    </div>
  );
});

export default EmptyState;
