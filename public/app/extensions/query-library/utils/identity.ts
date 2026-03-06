import { contextSrv } from 'app/core/core';

import { QueryTemplateRow } from '../types';

export const canEditQuery = (query: QueryTemplateRow) => {
  const userIsAuthor = query.user?.uid?.replace('user:', '') === contextSrv.user.uid;
  const userIsAdmin = contextSrv.hasRole('Admin');
  const userIsViewer = contextSrv.hasRole('Viewer');

  return (userIsAuthor && !userIsViewer) || userIsAdmin;
};
