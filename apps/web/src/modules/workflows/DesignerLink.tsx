import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { request, type Access } from './designer-api';
export function DesignerLink() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    void request<Access>('capabilities', 'GET', undefined, ac.signal)
      .then((a) => setVisible(a.canRead))
      .catch(() => {});
    return () => ac.abort();
  }, []);
  return visible ? <Link to="/workflow/designer">Workflow designer</Link> : null;
}
