/**
 * Сервис отправки SMS уведомлений
 * Поддержка нескольких провайдеров: SMS.ru, SMSC.ru, Twilio
 */

const axios = require('axios');

class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'sms.ru';
    this.apiKey = process.env.SMS_API_KEY;
    this.senderName = process.env.SMS_SENDER_NAME || 'AquaFilter';
    this.siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    
    // Проверка наличия API ключа
    if (!this.apiKey) {
      console.warn('⚠️ SMS_API_KEY не установлен в .env. SMS не будут отправляться.');
    }
  }
  
  // ============================================
  // ОСНОВНЫЕ МЕТОДЫ
  // ============================================
  
  /**
   * Уведомление о новом КП
   */
  async sendNewProposalNotification(phone, proposalNumber, proposalLink) {
    const message = `Добрый день! Для вас подготовлено коммерческое предложение ${proposalNumber}. Посмотреть: ${proposalLink}`;
    
    return this.send(phone, message, 'new_proposal');
  }
  
  /**
   * Создание аккаунта после согласия с КП
   */
  async sendAccountCreatedNotification(phone, login, tempPassword) {
    const loginUrl = `${this.siteUrl}/login`;
    const message = `Ваш аккаунт создан!\nЛогин: ${login}\nПароль: ${tempPassword}\nВойти: ${loginUrl}\nПожалуйста, смените пароль после первого входа.`;
    
    return this.send(phone, message, 'account_created');
  }
  
  /**
   * Подтверждение принятия КП
   */
  async sendProposalAcceptedNotification(phone, proposalNumber) {
    const message = `Спасибо! Ваше согласие на КП ${proposalNumber} получено. Наш менеджер свяжется с вами в ближайшее время.`;
    
    return this.send(phone, message, 'proposal_accepted');
  }
  
  /**
   * Уведомление о редактировании КП
   */
  async sendProposalEditedNotification(phone, proposalNumber, proposalLink) {
    const message = `Коммерческое предложение ${proposalNumber} было обновлено. Посмотреть изменения: ${proposalLink}`;
    
    return this.send(phone, message, 'proposal_edited');
  }
  
  /**
   * Напоминание о скором истечении срока КП
   */
  async sendProposalExpiringNotification(phone, proposalNumber, daysLeft, proposalLink) {
    const message = `Напоминаем: срок действия КП ${proposalNumber} истекает через ${daysLeft} ${this.getDaysWord(daysLeft)}. Просмотреть: ${proposalLink}`;
    
    return this.send(phone, message, 'proposal_expiring');
  }
  
  /**
   * Уведомление монтажнику о новом заказе
   */
  async sendNewOrderToTechnician(phone, orderNumber, clientAddress, date) {
    const message = `Новый заказ ${orderNumber}!\nАдрес: ${clientAddress}\nДата: ${date}\nПроверьте детали в личном кабинете.`;
    
    return this.send(phone, message, 'new_order_technician');
  }
  
  /**
   * SMS с кодом подтверждения
   */
  async sendVerificationCode(phone, code) {
    const message = `Ваш код подтверждения: ${code}\nНе сообщайте его никому.`;
    
    return this.send(phone, message, 'verification_code');
  }
  
  /**
   * Уведомление о записи на сервис
   */
  async sendServiceAppointmentNotification(phone, date, time) {
    const message = `Вы записаны на сервисное обслуживание ${date} в ${time}. За день до визита мы вам напомним.`;
    
    return this.send(phone, message, 'service_appointment');
  }
  
  /**
   * Напоминание о предстоящем сервисе
   */
  async sendServiceReminderNotification(phone, date, time) {
    const message = `Напоминаем: завтра ${date} в ${time} запланировано сервисное обслуживание вашей системы водоочистки.`;
    
    return this.send(phone, message, 'service_reminder');
  }
  
  // ============================================
  // НИЗКОУРОВНЕВАЯ ОТПРАВКА
  // ============================================
  
  /**
   * Универсальный метод отправки SMS
   */
  async send(phone, message, type = 'general') {
    // Валидация
    if (!phone || !message) {
      throw new Error('Телефон и сообщение обязательны');
    }
    
    // Форматирование номера
    const formattedPhone = this.formatPhone(phone);
    
    // Проверка наличия API ключа
    if (!this.apiKey) {
      console.log(`📱 SMS (${type}) не отправлено (нет API ключа):`);
      console.log(`   Телефон: ${formattedPhone}`);
      console.log(`   Сообщение: ${message.substring(0, 100)}...`);
      
      return {
        success: false,
        status: 'no_api_key',
        provider: this.provider,
        phone: formattedPhone,
        message,
        type
      };
    }
    
    // Отправка через выбранный провайдер
    try {
      let result;
      
      switch (this.provider) {
        case 'sms.ru':
          result = await this.sendViaSMSRu(formattedPhone, message);
          break;
          
        case 'smsc.ru':
          result = await this.sendViaSMSC(formattedPhone, message);
          break;
          
        case 'twilio':
          result = await this.sendViaTwilio(formattedPhone, message);
          break;
          
        default:
          throw new Error(`Неизвестный провайдер SMS: ${this.provider}`);
      }
      
      // Логирование успешной отправки
      console.log(`✅ SMS (${type}) отправлено через ${this.provider}:`);
      console.log(`   Телефон: ${formattedPhone}`);
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
      
      return {
        success: true,
        status: 'sent',
        provider: this.provider,
        phone: formattedPhone,
        message,
        type,
        messageId: result.messageId,
        cost: result.cost || null,
        sentAt: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Ошибка отправки SMS (${type}):`, error.message);
      
      return {
        success: false,
        status: 'failed',
        provider: this.provider,
        phone: formattedPhone,
        message,
        type,
        error: error.message,
        sentAt: new Date()
      };
    }
  }
  
  // ============================================
  // ПРОВАЙДЕРЫ
  // ============================================
  
  /**
   * Отправка через SMS.ru
   */
  async sendViaSMSRu(phone, message) {
    const url = 'https://sms.ru/sms/send';
    
    const params = {
      api_id: this.apiKey,
      to: phone,
      msg: message,
      json: 1,
      from: this.senderName
    };
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    if (data.status === 'OK') {
      const smsData = data.sms[phone];
      
      if (smsData.status === 'OK') {
        return {
          messageId: smsData.sms_id,
          cost: smsData.cost
        };
      } else {
        throw new Error(`SMS.ru ошибка: ${smsData.status_text}`);
      }
    } else {
      throw new Error(`SMS.ru ошибка: ${data.status_text || 'Unknown error'}`);
    }
  }
  
  /**
   * Отправка через SMSC.ru
   */
  async sendViaSMSC(phone, message) {
    const url = 'https://smsc.ru/sys/send.php';
    
    const params = {
      login: process.env.SMSC_LOGIN,
      psw: this.apiKey,
      phones: phone,
      mes: message,
      fmt: 3, // JSON формат
      sender: this.senderName
    };
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    if (data.error) {
      throw new Error(`SMSC.ru ошибка: ${data.error} - ${data.error_code}`);
    }
    
    return {
      messageId: data.id,
      cost: data.cost
    };
  }
  
  /**
   * Отправка через Twilio
   */
  async sendViaTwilio(phone, message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = this.apiKey;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const data = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: message
    });
    
    const response = await axios.post(url, data, {
      auth: {
        username: accountSid,
        password: authToken
      }
    });
    
    return {
      messageId: response.data.sid,
      cost: response.data.price
    };
  }
  
  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================
  
  /**
   * Форматирование номера телефона
   */
  formatPhone(phone) {
    // Убрать все нецифровые символы
    let cleaned = phone.replace(/\D/g, '');
    
    // Если номер начинается с 8, заменить на 7
    if (cleaned.startsWith('8')) {
      cleaned = '7' + cleaned.substring(1);
    }
    
    // Если номер не начинается с 7, добавить 7
    if (!cleaned.startsWith('7')) {
      cleaned = '7' + cleaned;
    }
    
    return cleaned;
  }
  
  /**
   * Склонение слова "день"
   */
  getDaysWord(days) {
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = ['день', 'дня', 'дней'];
    
    return titles[
      days % 100 > 4 && days % 100 < 20
        ? 2
        : cases[days % 10 < 5 ? days % 10 : 5]
    ];
  }
  
  /**
   * Проверка баланса (для SMS.ru)
   */
  async checkBalance() {
    if (this.provider !== 'sms.ru') {
      throw new Error('Проверка баланса доступна только для SMS.ru');
    }
    
    const url = 'https://sms.ru/my/balance';
    
    const params = {
      api_id: this.apiKey,
      json: 1
    };
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    if (data.status === 'OK') {
      return {
        balance: data.balance,
        currency: 'RUB'
      };
    } else {
      throw new Error(`Ошибка проверки баланса: ${data.status_text}`);
    }
  }
  
  /**
   * Получение статуса SMS (для SMS.ru)
   */
  async getStatus(messageId) {
    if (this.provider !== 'sms.ru') {
      throw new Error('Проверка статуса доступна только для SMS.ru');
    }
    
    const url = 'https://sms.ru/sms/status';
    
    const params = {
      api_id: this.apiKey,
      sms_id: messageId,
      json: 1
    };
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    if (data.status === 'OK') {
      const smsData = data.sms[messageId];
      
      return {
        status: smsData.status,
        statusText: smsData.status_text,
        cost: smsData.cost
      };
    } else {
      throw new Error(`Ошибка получения статуса: ${data.status_text}`);
    }
  }
  
  // ============================================
  // МАССОВАЯ ОТПРАВКА
  // ============================================
  
  /**
   * Массовая отправка SMS
   */
  async sendBulk(recipients) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.send(
          recipient.phone,
          recipient.message,
          recipient.type || 'bulk'
        );
        
        results.push({
          phone: recipient.phone,
          success: result.success,
          messageId: result.messageId
        });
        
        // Задержка между отправками (антиспам)
        await this.delay(500);
        
      } catch (error) {
        results.push({
          phone: recipient.phone,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Задержка
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// ЭКСПОРТ
// ============================================

module.exports = new SMSService();
