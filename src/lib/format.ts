const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateTimeFormatter.format(date)
}

export function displayName(
  profile: { full_name: string | null; email: string } | null | undefined,
): string {
  if (!profile) {
    return 'Не назначен'
  }

  const fullName = profile.full_name?.trim()
  return fullName ? fullName : profile.email
}

export function pluralTasks(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} задача`
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} задачи`
  }

  return `${count} задач`
}
