import {
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMaxDateUTC(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

@ValidatorConstraint({ name: 'expiryDateRange', async: false })
export class ExpiryDateRangeValidator implements ValidatorConstraintInterface {
  validate(value: string | null | undefined): boolean {
    if (!value) return true;

    if (!DATE_FORMAT_REGEX.test(value)) return false;

    const today = getTodayUTC();
    if (value < today) return false;

    const maxDate = getMaxDateUTC();
    if (value > maxDate) return false;

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const value = args.value;

    if (!value || !DATE_FORMAT_REGEX.test(value)) {
      return 'Enter a valid date';
    }

    const today = getTodayUTC();
    if (value < today) {
      return "Expiry can't be in the past";
    }

    return "Expiry can't be more than 1 year away";
  }
}

export class CreateLinkDto {
  @IsNotEmpty({ message: 'Short code is required' })
  short_code: string;

  @IsUrl({}, { message: 'Enter a valid URL' })
  long_url: string;

  @IsOptional()
  @Validate(ExpiryDateRangeValidator)
  expires_at?: string | null;
}