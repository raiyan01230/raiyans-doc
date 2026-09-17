import {
  sendSecurityEmail,
  sendTestSecurityEmail,
  getEmailConfigStatus,
  getNotificationSettings,
  updateNotificationSettings,
  emailDeliveryLogs,
  defaultNotificationSettings,
  type EmailDeliveryLogEntry,
  type NotificationSettings,
} from '../src/lib/security-email';

export {
  sendSecurityEmail as sendResendSecurityEmail,
  sendTestSecurityEmail,
  getEmailConfigStatus,
  getNotificationSettings,
  updateNotificationSettings,
  emailDeliveryLogs,
  defaultNotificationSettings,
  type EmailDeliveryLogEntry,
  type NotificationSettings,
};
