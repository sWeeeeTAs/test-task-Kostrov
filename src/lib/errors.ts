export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim() !== '') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim() !== '') {
      return message
    }
  }

  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'Неверный email или пароль.'
  }

  if (/email not confirmed/i.test(message)) {
    return 'Email не подтверждён. Обратитесь к администратору.'
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return 'Не удалось связаться с Supabase. Проверьте адрес проекта и интернет-соединение.'
  }

  return message
}
