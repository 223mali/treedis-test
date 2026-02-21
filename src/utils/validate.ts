import { validate, ValidationError } from "class-validator";
import { plainToInstance } from "class-transformer";

export async function validateDto<T extends object>(
  DtoClass: new () => T,
  plain: Record<string, unknown>,
): Promise<{ instance: T; errors: string[] }> {
  const instance = plainToInstance(DtoClass, plain);
  const validationErrors: ValidationError[] = await validate(instance);

  const errors = validationErrors.flatMap((err) =>
    Object.values(err.constraints || {}),
  );

  return { instance, errors };
}
