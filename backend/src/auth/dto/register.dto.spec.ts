// auth/dto/register.dto.spec.ts
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('should fail validation if email is missing', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.password = 'Abcde@49';
    dto.email = ''; // empty triggers @IsNotEmpty

    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
    expect(emailError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('should fail validation if email format is invalid', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.password = 'Abcde@49';
    dto.email = 'not-an-email'; // non-empty but bad format, triggers @IsEmail

    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
    expect(emailError?.constraints).toHaveProperty('isEmail');
  });

  it('should pass validation with valid input', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@test.com';
    dto.password = 'Abcde@49';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation if password does not meet complexity rules', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@test.com';
    dto.password = 'weak'; // too short, no uppercase/special char

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
  });
});
